-- ============================================================
-- MIGRATION: 012_manifest_state_machine.sql
-- Project: Sistema de Reparto (prefix: re_)
-- Purpose: Manifest state machine, order assignment/dissociation,
--          auto-closure, vehicle double-booking prevention,
--          capacity recompute, GRE generation, and driver RLS.
-- ============================================================

-- --------------------------------------------------------
-- 1. ALTER vehicle_id TO NULLABLE
-- --------------------------------------------------------

ALTER TABLE public.re_dispatch_manifests ALTER COLUMN vehicle_id DROP NOT NULL;

-- --------------------------------------------------------
-- 2. CAPACITY RECOMPUTE HELPER
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_recompute_manifest_totals(p_manifest_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.re_dispatch_manifests
  SET
    total_weight_kg = COALESCE((
      SELECT SUM(oi.quantity * COALESCE(p.weight_kg, 0))
      FROM public.re_manifest_orders mo
      JOIN public.re_orders ord ON ord.id = mo.order_id
      JOIN public.re_order_items oi ON oi.order_id = ord.id
      JOIN public.re_products p ON p.id = oi.product_id
      WHERE mo.manifest_id = p_manifest_id
    ), 0),
    total_volume_m3 = COALESCE((
      SELECT SUM(oi.quantity * COALESCE(p.volume_m3, 0))
      FROM public.re_manifest_orders mo
      JOIN public.re_orders ord ON ord.id = mo.order_id
      JOIN public.re_order_items oi ON oi.order_id = ord.id
      JOIN public.re_products p ON p.id = oi.product_id
      WHERE mo.manifest_id = p_manifest_id
    ), 0)
  WHERE id = p_manifest_id;
END;
$$;

-- --------------------------------------------------------
-- 3. ADD ORDER TO MANIFEST
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_manifest_add_order(p_manifest_id UUID, p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_manifest RECORD;
  v_order RECORD;
BEGIN
  SELECT * INTO v_manifest FROM public.re_dispatch_manifests WHERE id = p_manifest_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'MANIFEST_NOT_FOUND'; END IF;
  IF v_manifest.status != 'DRAFT' THEN RETURN 'MANIFEST_NOT_DRAFT'; END IF;

  SELECT * INTO v_order FROM public.re_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'ORDER_NOT_FOUND'; END IF;
  IF v_order.branch_id != v_manifest.branch_id THEN RETURN 'ORDER_BRANCH_MISMATCH'; END IF;

  -- Check duplicate before status: gives accurate error when order is PROGRAMMED in another manifest
  IF EXISTS (
    SELECT 1 FROM public.re_manifest_orders mo
    JOIN public.re_dispatch_manifests m ON m.id = mo.manifest_id
    WHERE mo.order_id = p_order_id AND m.status != 'CLOSED'
  ) THEN
    RETURN 'ORDER_ALREADY_IN_MANIFEST';
  END IF;

  IF v_order.status != 'APPROVED' THEN RETURN 'ORDER_NOT_APPROVED'; END IF;

  INSERT INTO public.re_manifest_orders (manifest_id, order_id, delivery_sequence)
  VALUES (p_manifest_id, p_order_id, (
    SELECT COALESCE(MAX(delivery_sequence), 0) + 1
    FROM public.re_manifest_orders
    WHERE manifest_id = p_manifest_id
  ));

  UPDATE public.re_orders SET status = 'PROGRAMMED' WHERE id = p_order_id;
  PERFORM public.re_recompute_manifest_totals(p_manifest_id);

  RETURN 'SUCCESS';
END;
$$;

-- --------------------------------------------------------
-- 4. REMOVE ORDER FROM MANIFEST
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_manifest_remove_order(p_manifest_id UUID, p_order_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_manifest RECORD;
BEGIN
  SELECT * INTO v_manifest FROM public.re_dispatch_manifests WHERE id = p_manifest_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'MANIFEST_NOT_FOUND'; END IF;
  IF v_manifest.status != 'DRAFT' THEN RETURN 'MANIFEST_NOT_DRAFT'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.re_manifest_orders WHERE manifest_id = p_manifest_id AND order_id = p_order_id
  ) THEN
    RETURN 'ORDER_NOT_IN_MANIFEST';
  END IF;

  DELETE FROM public.re_manifest_orders WHERE manifest_id = p_manifest_id AND order_id = p_order_id;
  UPDATE public.re_orders SET status = 'APPROVED' WHERE id = p_order_id;
  PERFORM public.re_recompute_manifest_totals(p_manifest_id);

  RETURN 'SUCCESS';
END;
$$;

-- --------------------------------------------------------
-- 5. GENERATE GRE FOR MANIFEST (idempotent)
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_generate_gre_for_manifest(p_manifest_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_manifest RECORD;
  v_branch RECORD;
  v_serie TEXT;
  v_correlativo TEXT;
  v_correlativo_num BIGINT;
  v_gre_id UUID;
BEGIN
  SELECT * INTO v_manifest FROM public.re_dispatch_manifests WHERE id = p_manifest_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_branch FROM public.re_branches WHERE id = v_manifest.branch_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Idempotency
  SELECT id INTO v_gre_id FROM public.re_remission_guides WHERE manifest_id = p_manifest_id LIMIT 1;
  IF FOUND THEN RETURN v_gre_id; END IF;

  v_serie := COALESCE(v_branch.gre_serie, 'T001');
  SELECT COUNT(*) + 1 INTO v_correlativo_num
  FROM public.re_remission_guides
  WHERE branch_id = v_manifest.branch_id AND serie = v_serie;
  v_correlativo := LPAD(v_correlativo_num::text, 8, '0');

  INSERT INTO public.re_remission_guides (manifest_id, branch_id, serie, correlativo, sunat_status)
  VALUES (p_manifest_id, v_manifest.branch_id, v_serie, v_correlativo, 'PENDIENTE')
  RETURNING id INTO v_gre_id;

  RETURN v_gre_id;
END;
$$;

-- --------------------------------------------------------
-- 6. MANIFEST STATE TRANSITION
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_transition_manifest_status(
  p_manifest_id UUID,
  p_to_state re_manifest_status,
  p_user_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_manifest RECORD;
  v_from_state re_manifest_status;
  v_driver_count INT;
  v_order_count INT;
  v_gre_status re_sunat_status;
BEGIN
  SELECT * INTO v_manifest FROM public.re_dispatch_manifests WHERE id = p_manifest_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'MANIFEST_NOT_FOUND'; END IF;

  v_from_state := v_manifest.status;

  IF v_from_state = p_to_state THEN RETURN 'SUCCESS'; END IF;

  -- Valid transitions
  IF NOT (
    (v_from_state = 'DRAFT' AND p_to_state = 'CONFIRMED') OR
    (v_from_state = 'CONFIRMED' AND p_to_state = 'EN_ROUTE') OR
    (v_from_state = 'EN_ROUTE' AND p_to_state = 'CLOSED')
  ) THEN
    RETURN 'INVALID_TRANSITION';
  END IF;

  -- EN_ROUTE->CLOSED is system-only (trigger); reject via RPC
  IF v_from_state = 'EN_ROUTE' AND p_to_state = 'CLOSED' THEN
    RETURN 'INVALID_TRANSITION';
  END IF;

  IF p_to_state = 'CONFIRMED' THEN
    -- Guard: exactly one DRIVER
    SELECT COUNT(*) INTO v_driver_count
    FROM public.re_manifest_personnel
    WHERE manifest_id = p_manifest_id AND role = 'DRIVER';
    IF v_driver_count = 0 THEN RETURN 'NO_DRIVER_ASSIGNED'; END IF;

    -- Guard: at least one order
    SELECT COUNT(*) INTO v_order_count
    FROM public.re_manifest_orders
    WHERE manifest_id = p_manifest_id;
    IF v_order_count = 0 THEN RETURN 'MANIFEST_EMPTY'; END IF;

    -- Guard: vehicle assigned
    IF v_manifest.vehicle_id IS NULL THEN RETURN 'MANIFEST_NO_VEHICLE'; END IF;

    -- Generate GRE (fire-and-forget within transaction)
    PERFORM public.re_generate_gre_for_manifest(p_manifest_id);
  END IF;

  IF p_to_state = 'EN_ROUTE' THEN
    -- Guard: GRE accepted
    SELECT sunat_status INTO v_gre_status
    FROM public.re_remission_guides
    WHERE manifest_id = p_manifest_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_gre_status IS NULL OR v_gre_status != 'ACEPTADO' THEN
      RETURN 'GRE_NOT_ACCEPTED';
    END IF;
  END IF;

  UPDATE public.re_dispatch_manifests SET status = p_to_state WHERE id = p_manifest_id;
  RETURN 'SUCCESS';
END;
$$;

-- --------------------------------------------------------
-- 7. SYNC ORDER STATUS -> MANIFEST ORDER DELIVERY STATUS
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_sync_manifest_order_delivery_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('DELIVERED', 'PARTIAL', 'REJECTED') THEN
    UPDATE public.re_manifest_orders
    SET delivery_status = CASE NEW.status
      WHEN 'DELIVERED' THEN 'DELIVERED'::re_manifest_delivery_status
      WHEN 'PARTIAL'   THEN 'PARTIAL'::re_manifest_delivery_status
      WHEN 'REJECTED'  THEN 'REJECTED'::re_manifest_delivery_status
    END
    WHERE order_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_re_orders_sync_manifest_delivery
  AFTER UPDATE OF status ON public.re_orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.re_sync_manifest_order_delivery_status();

-- --------------------------------------------------------
-- 8. AUTO-CLOSURE TRIGGER
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_manifest_auto_close()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_manifest_id UUID;
  v_manifest_status re_manifest_status;
  v_total_orders INT;
  v_terminal_orders INT;
BEGIN
  v_manifest_id := COALESCE(NEW.manifest_id, OLD.manifest_id);

  SELECT status INTO v_manifest_status
  FROM public.re_dispatch_manifests
  WHERE id = v_manifest_id;

  IF v_manifest_status != 'EN_ROUTE' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_total_orders
  FROM public.re_manifest_orders
  WHERE manifest_id = v_manifest_id;

  IF v_total_orders = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_terminal_orders
  FROM public.re_manifest_orders
  WHERE manifest_id = v_manifest_id
    AND delivery_status IN ('DELIVERED', 'PARTIAL', 'REJECTED');

  IF v_total_orders = v_terminal_orders THEN
    UPDATE public.re_dispatch_manifests
    SET status = 'CLOSED'
    WHERE id = v_manifest_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_re_manifest_orders_auto_close
  AFTER INSERT OR UPDATE OF delivery_status ON public.re_manifest_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.re_manifest_auto_close();

-- --------------------------------------------------------
-- 9. VEHICLE DOUBLE-BOOKING PREVENTION
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_manifest_vehicle_double_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.vehicle_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.vehicle_id IS NOT DISTINCT FROM NEW.vehicle_id THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.re_dispatch_manifests
    WHERE vehicle_id = NEW.vehicle_id
      AND branch_id = NEW.branch_id
      AND manifest_date = NEW.manifest_date
      AND status IN ('DRAFT', 'CONFIRMED', 'EN_ROUTE')
      AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'VEHICLE_ALREADY_SCHEDULED';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_re_dispatch_manifests_double_booking
  BEFORE INSERT OR UPDATE OF vehicle_id ON public.re_dispatch_manifests
  FOR EACH ROW
  EXECUTE FUNCTION public.re_manifest_vehicle_double_booking();

-- --------------------------------------------------------
-- 10. RLS POLICY: DRIVER EN_ROUTE TRANSITION
-- --------------------------------------------------------

CREATE POLICY re_dispatch_manifests_driver_en_route
  ON public.re_dispatch_manifests
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id()
    AND status = 'CONFIRMED'
    AND id IN (
      SELECT manifest_id FROM public.re_manifest_personnel
      WHERE person_id = auth.uid() AND role = 'DRIVER'
    )
  );

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
