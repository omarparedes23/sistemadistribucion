-- ============================================================
-- MIGRATION: 009_order_state_machine.sql
-- Project: Sistema de Reparto (prefix: re_)
-- Purpose: Order state machine with guards, effects, invoice
--          and credit note generation.
-- ============================================================

-- --------------------------------------------------------
-- 1. TRANSITION VALIDATOR
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_is_valid_transition(
  p_from_state re_order_state,
  p_to_state   re_order_state
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_from_state = p_to_state THEN
    RETURN true;
  END IF;

  RETURN CASE p_from_state
    WHEN 'DRAFT'      THEN p_to_state IN ('PENDING', 'CANCELLED')
    WHEN 'PENDING'    THEN p_to_state IN ('APPROVED', 'CANCELLED')
    WHEN 'APPROVED'   THEN p_to_state IN ('PROGRAMMED', 'CANCELLED')
    WHEN 'PROGRAMMED' THEN p_to_state IN ('EN_ROUTE', 'CANCELLED')
    WHEN 'EN_ROUTE'   THEN p_to_state IN ('DELIVERED', 'PARTIAL', 'REJECTED', 'CANCELLED')
    ELSE false
  END;
END;
$$;


-- --------------------------------------------------------
-- 2. INVOICE GENERATOR
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_generate_invoice_for_order(p_order_id UUID)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_order         RECORD;
  v_customer      RECORD;
  v_doc_type      re_doc_type;
  v_serie         TEXT;
  v_correlativo   TEXT;
  v_correlativo_num BIGINT;
  v_subtotal      NUMERIC(12,2);
  v_igv_amount    NUMERIC(12,2);
  v_total         NUMERIC(12,2);
  v_invoice_id    UUID;
  v_item          RECORD;
BEGIN
  -- Get order
  SELECT * INTO v_order FROM public.re_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Idempotency: return existing invoice
  SELECT id INTO v_invoice_id FROM public.re_invoices WHERE order_id = p_order_id LIMIT 1;
  IF FOUND THEN
    RETURN v_invoice_id;
  END IF;

  -- Get customer to determine doc type
  SELECT * INTO v_customer FROM public.re_customers WHERE id = v_order.customer_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF LENGTH(REGEXP_REPLACE(v_customer.ruc_or_dni, '[^0-9]', '', 'g')) = 11 THEN
    v_doc_type := 'FACTURA';
    v_serie := COALESCE((SELECT factura_serie FROM public.re_branches WHERE id = v_order.branch_id), 'F001');
  ELSE
    v_doc_type := 'BOLETA';
    v_serie := COALESCE((SELECT boleta_serie FROM public.re_branches WHERE id = v_order.branch_id), 'B001');
  END IF;

  -- Correlativo: simple COUNT(*) + 1 per (branch, doc_type, serie)
  SELECT COUNT(*) + 1 INTO v_correlativo_num
  FROM public.re_invoices
  WHERE branch_id = v_order.branch_id AND doc_type = v_doc_type AND serie = v_serie;

  v_correlativo := LPAD(v_correlativo_num::text, 8, '0');

  -- Calculate totals from order items
  SELECT COALESCE(SUM(line_total), 0) INTO v_subtotal
  FROM public.re_order_items
  WHERE order_id = p_order_id;

  v_igv_amount := ROUND(v_subtotal * 0.18, 2);
  v_total      := v_subtotal + v_igv_amount;

  -- Create invoice
  INSERT INTO public.re_invoices (
    order_id, branch_id, customer_id, doc_type, serie, correlativo,
    subtotal, igv_amount, total, issue_date, sunat_status
  ) VALUES (
    p_order_id, v_order.branch_id, v_order.customer_id, v_doc_type, v_serie, v_correlativo,
    v_subtotal, v_igv_amount, v_total, CURRENT_DATE, 'PENDIENTE'
  ) RETURNING id INTO v_invoice_id;

  -- Create invoice items
  FOR v_item IN
    SELECT * FROM public.re_order_items WHERE order_id = p_order_id
  LOOP
    INSERT INTO public.re_invoice_items (
      invoice_id, product_id, quantity, unit_price, discount_pct,
      discount_amount, line_total, is_bonus
    ) VALUES (
      v_invoice_id, v_item.product_id, v_item.quantity, v_item.unit_price,
      v_item.discount_pct, v_item.discount_amount, v_item.line_total, v_item.is_bonus
    );
  END LOOP;

  RETURN v_invoice_id;
END;
$$;


-- --------------------------------------------------------
-- 3. CREDIT NOTE GENERATOR
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_generate_credit_note_for_order(
  p_order_id      UUID,
  p_returned_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_order         RECORD;
  v_invoice       RECORD;
  v_serie         TEXT;
  v_correlativo   TEXT;
  v_correlativo_num BIGINT;
  v_subtotal      NUMERIC(12,2);
  v_igv_amount    NUMERIC(12,2);
  v_total         NUMERIC(12,2);
  v_credit_note_id UUID;
  v_item          JSONB;
  v_product_id    UUID;
  v_quantity      NUMERIC(12,4);
  v_unit_price    NUMERIC(12,2);
  v_line_total    NUMERIC(12,2);
BEGIN
  SELECT * INTO v_order FROM public.re_orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Find the latest invoice for this order
  SELECT * INTO v_invoice FROM public.re_invoices WHERE order_id = p_order_id ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Idempotency: return existing credit note
  SELECT id INTO v_credit_note_id FROM public.re_credit_notes WHERE order_id = p_order_id LIMIT 1;
  IF FOUND THEN
    RETURN v_credit_note_id;
  END IF;

  -- Determine credit note serie
  IF v_invoice.doc_type = 'FACTURA' THEN
    v_serie := 'FC01';
  ELSE
    v_serie := 'BC01';
  END IF;

  -- Correlativo: simple COUNT(*) + 1 per (branch, serie)
  SELECT COUNT(*) + 1 INTO v_correlativo_num
  FROM public.re_credit_notes
  WHERE branch_id = v_order.branch_id AND serie = v_serie;

  v_correlativo := LPAD(v_correlativo_num::text, 8, '0');

  -- Create credit note shell (totals computed after items)
  INSERT INTO public.re_credit_notes (
    invoice_id, order_id, branch_id, serie, correlativo, reason,
    subtotal, igv_amount, total, issue_date, sunat_status
  ) VALUES (
    v_invoice.id, p_order_id, v_order.branch_id, v_serie, v_correlativo,
    '07 - Devolución de bienes', 0, 0, 0, CURRENT_DATE, 'PENDIENTE'
  ) RETURNING id INTO v_credit_note_id;

  -- Process returned items
  v_subtotal := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_returned_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity   := (v_item->>'quantity')::NUMERIC;

    -- Get unit price from the original order item
    SELECT unit_price INTO v_unit_price
    FROM public.re_order_items
    WHERE order_id = p_order_id AND product_id = v_product_id
    LIMIT 1;

    IF v_unit_price IS NULL THEN
      v_unit_price := 0;
    END IF;

    v_line_total := ROUND(v_quantity * v_unit_price, 2);
    v_subtotal   := v_subtotal + v_line_total;

    INSERT INTO public.re_credit_note_items (
      credit_note_id, product_id, quantity, unit_price, line_total
    ) VALUES (
      v_credit_note_id, v_product_id, v_quantity, v_unit_price, v_line_total
    );
  END LOOP;

  IF v_subtotal <= 0 THEN
    DELETE FROM public.re_credit_notes WHERE id = v_credit_note_id;
    RETURN NULL;
  END IF;

  v_igv_amount := ROUND(v_subtotal * 0.18, 2);
  v_total      := v_subtotal + v_igv_amount;

  UPDATE public.re_credit_notes
  SET subtotal = v_subtotal, igv_amount = v_igv_amount, total = v_total
  WHERE id = v_credit_note_id;

  RETURN v_credit_note_id;
END;
$$;


-- --------------------------------------------------------
-- 4. STATE TRANSITION ORCHESTRATOR
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_transition_order_state(
  p_order_id       UUID,
  p_to_state       re_order_state,
  p_user_id        UUID,
  p_returned_items JSONB DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_order          RECORD;
  v_from_state     re_order_state;
  v_warehouse_id   UUID;
  v_item           RECORD;
  v_stock_actual   NUMERIC(12,4);
  v_stock_reserved NUMERIC(12,4);
  v_stock_available NUMERIC(12,4);
  v_unit_cost      NUMERIC(12,4);
  v_delivered_qty  NUMERIC(12,4);
  v_returned_qty   NUMERIC(12,4);
  v_invoice_id     UUID;
  v_credit_note_id UUID;
BEGIN
  -- Lock order row
  SELECT * INTO v_order FROM public.re_orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'ORDER_NOT_FOUND';
  END IF;

  v_from_state := v_order.status;

  -- No-op if already in target state
  IF v_from_state = p_to_state THEN
    RETURN 'SUCCESS';
  END IF;

  -- Validate transition
  IF NOT public.re_is_valid_transition(v_from_state, p_to_state) THEN
    RETURN 'INVALID_TRANSITION';
  END IF;

  -- Resolve default warehouse for the branch (needed for inventory movements)
  SELECT id INTO v_warehouse_id
  FROM public.re_warehouses
  WHERE branch_id = v_order.branch_id AND active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_warehouse_id IS NULL THEN
    RETURN 'NO_WAREHOUSE_FOUND';
  END IF;

  -- ============================================================
  -- STATE-SPECIFIC GUARDS & EFFECTS
  -- ============================================================

  IF p_to_state = 'APPROVED' THEN
    -- GUARD: stock_available >= qty for every line
    FOR v_item IN
      SELECT * FROM public.re_order_items WHERE order_id = p_order_id
    LOOP
      SELECT stock_available INTO v_stock_available
      FROM public.re_inventory_stock
      WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id
      FOR UPDATE;

      IF COALESCE(v_stock_available, 0) < v_item.quantity THEN
        RETURN 'INSUFFICIENT_STOCK';
      END IF;
    END LOOP;

    -- EFFECT: reserve stock
    FOR v_item IN
      SELECT * FROM public.re_order_items WHERE order_id = p_order_id
    LOOP
      UPDATE public.re_inventory_stock
      SET stock_reserved = stock_reserved + v_item.quantity
      WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id;
    END LOOP;

  ELSIF p_to_state = 'DELIVERED' THEN
    -- EFFECT: release reservation, create OUT/SALE movement (trigger deducts stock_actual), invoice
    FOR v_item IN
      SELECT * FROM public.re_order_items WHERE order_id = p_order_id
    LOOP
      SELECT stock_actual, stock_reserved, weighted_avg_cost
      INTO v_stock_actual, v_stock_reserved, v_unit_cost
      FROM public.re_inventory_stock
      WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id
      FOR UPDATE;

      IF COALESCE(v_stock_actual, 0) < v_item.quantity THEN
        RETURN 'INSUFFICIENT_STOCK';
      END IF;

      -- Release reservation only; trigger (trg_re_inventory_movements_stock) handles stock_actual
      UPDATE public.re_inventory_stock
      SET stock_reserved = GREATEST(stock_reserved - v_item.quantity, 0)
      WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id;

      INSERT INTO public.re_inventory_movements (
        branch_id, warehouse_id, product_id, type, reason_code,
        quantity, unit_cost, reference_id, reference_type, user_id, movement_date
      ) VALUES (
        v_order.branch_id, v_warehouse_id, v_item.product_id, 'OUT', 'SALE',
        v_item.quantity, COALESCE(v_unit_cost, 0), p_order_id, 'order', p_user_id, CURRENT_DATE
      );
    END LOOP;

    v_invoice_id := public.re_generate_invoice_for_order(p_order_id);
    IF v_invoice_id IS NULL THEN
      RETURN 'INVOICE_GENERATION_FAILED';
    END IF;

  ELSIF p_to_state = 'PARTIAL' THEN
    -- Validate returned items payload
    IF p_returned_items IS NULL OR jsonb_array_length(p_returned_items) = 0 THEN
      RETURN 'MISSING_RETURNED_ITEMS';
    END IF;

    -- EFFECT: delivered deducted, returned added back, reservation released,
    --         IN/SALES_RETURN movement, invoice + credit note
    FOR v_item IN
      SELECT * FROM public.re_order_items WHERE order_id = p_order_id
    LOOP
      SELECT stock_actual, stock_reserved, weighted_avg_cost
      INTO v_stock_actual, v_stock_reserved, v_unit_cost
      FROM public.re_inventory_stock
      WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id
      FOR UPDATE;

      -- Determine how many of this line were returned
      SELECT COALESCE(SUM((value->>'quantity')::NUMERIC), 0) INTO v_returned_qty
      FROM jsonb_array_elements(p_returned_items)
      WHERE (value->>'product_id')::UUID = v_item.product_id;

      v_delivered_qty := GREATEST(v_item.quantity - v_returned_qty, 0);

      -- Guard: enough stock for delivered portion
      IF v_delivered_qty > 0 AND COALESCE(v_stock_actual, 0) < v_delivered_qty THEN
        RETURN 'INSUFFICIENT_STOCK';
      END IF;

      -- Deduct delivered from actual via trigger; no manual stock_actual update
      IF v_delivered_qty > 0 THEN
        INSERT INTO public.re_inventory_movements (
          branch_id, warehouse_id, product_id, type, reason_code,
          quantity, unit_cost, reference_id, reference_type, user_id, movement_date
        ) VALUES (
          v_order.branch_id, v_warehouse_id, v_item.product_id, 'OUT', 'SALE',
          v_delivered_qty, COALESCE(v_unit_cost, 0), p_order_id, 'order', p_user_id, CURRENT_DATE
        );
      END IF;

      -- Return stock back to actual via trigger; no manual stock_actual update
      IF v_returned_qty > 0 THEN
        INSERT INTO public.re_inventory_movements (
          branch_id, warehouse_id, product_id, type, reason_code,
          quantity, unit_cost, reference_id, reference_type, user_id, movement_date
        ) VALUES (
          v_order.branch_id, v_warehouse_id, v_item.product_id, 'IN', 'SALES_RETURN',
          v_returned_qty, COALESCE(v_unit_cost, 0), p_order_id, 'order', p_user_id, CURRENT_DATE
        );
      END IF;

      -- Release full reservation for this line
      UPDATE public.re_inventory_stock
      SET stock_reserved = GREATEST(stock_reserved - v_item.quantity, 0)
      WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id;
    END LOOP;

    v_invoice_id := public.re_generate_invoice_for_order(p_order_id);
    IF v_invoice_id IS NULL THEN
      RETURN 'INVOICE_GENERATION_FAILED';
    END IF;

    v_credit_note_id := public.re_generate_credit_note_for_order(p_order_id, p_returned_items);
    IF v_credit_note_id IS NULL THEN
      RETURN 'CREDIT_NOTE_GENERATION_FAILED';
    END IF;

  ELSIF p_to_state = 'REJECTED' THEN
    -- EFFECT: release reservation
    FOR v_item IN
      SELECT * FROM public.re_order_items WHERE order_id = p_order_id
    LOOP
      UPDATE public.re_inventory_stock
      SET stock_reserved = GREATEST(stock_reserved - v_item.quantity, 0)
      WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id;
    END LOOP;

  ELSIF p_to_state = 'CANCELLED' THEN
    -- EFFECT: release reservation if current state is APPROVED or later
    IF v_from_state IN ('APPROVED', 'PROGRAMMED', 'EN_ROUTE') THEN
      FOR v_item IN
        SELECT * FROM public.re_order_items WHERE order_id = p_order_id
      LOOP
        UPDATE public.re_inventory_stock
        SET stock_reserved = GREATEST(stock_reserved - v_item.quantity, 0)
        WHERE branch_id = v_order.branch_id AND product_id = v_item.product_id;
      END LOOP;
    END IF;

  END IF;

  -- Update order status
  UPDATE public.re_orders
  SET status = p_to_state
  WHERE id = p_order_id;

  RETURN 'SUCCESS';
END;
$$;

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
