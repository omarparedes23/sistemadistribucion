-- ============================================================
-- MIGRATION: 006_inventory_triggers.sql
-- Project: Sistema de Reparto (prefix: re_)
-- Phase 1: Foundation — Inventory stock triggers & validation
-- Stack: Supabase (PostgreSQL 15+)
-- ============================================================

-- --------------------------------------------------------
-- 1. TRIGGER FUNCTION: re_handle_inventory_movement()
--    AFTER INSERT on re_inventory_movements
--
-- Responsibilities:
--   - Upsert re_inventory_stock (INSERT or UPDATE)
--   - Recalculate Weighted Average Cost on IN movements
--   - Reject OUT movements that would make stock negative
--   - Reject duplicate INITIAL_STOCK for same (branch, warehouse, product)
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_handle_inventory_movement()
RETURNS TRIGGER AS $$
DECLARE
  v_current_stock DECIMAL(12,4);
  v_current_cost  DECIMAL(12,4);
  v_existing_movements INT;
BEGIN
  -- 1A. Reject duplicate INITIAL_STOCK
  -- If any movement already exists for this (branch, warehouse, product),
  -- INITIAL_STOCK is not allowed.
  IF NEW.reason_code = 'INITIAL_STOCK' THEN
    -- Exclude NEW row itself (trigger is AFTER INSERT, so the row is already in the table)
    SELECT COUNT(*) INTO v_existing_movements
    FROM public.re_inventory_movements
    WHERE branch_id  = NEW.branch_id
      AND warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id
      AND id <> NEW.id;

    IF v_existing_movements > 0 THEN
      RAISE EXCEPTION 'Duplicate INITIAL_STOCK rejected: a movement already exists for branch_id=%, warehouse_id=%, product_id=%',
        NEW.branch_id, NEW.warehouse_id, NEW.product_id;
    END IF;
  END IF;

  -- 1B. IN movement: upsert stock + recalculate weighted average cost
  IF NEW.type = 'IN' THEN
    INSERT INTO public.re_inventory_stock (
      branch_id,
      warehouse_id,
      product_id,
      stock_actual,
      weighted_avg_cost
    )
    VALUES (
      NEW.branch_id,
      NEW.warehouse_id,
      NEW.product_id,
      NEW.quantity,
      NEW.unit_cost
    )
    ON CONFLICT (branch_id, warehouse_id, product_id)
    DO UPDATE SET
      stock_actual = public.re_inventory_stock.stock_actual + NEW.quantity,
      weighted_avg_cost = CASE
        WHEN public.re_inventory_stock.stock_actual = 0 THEN
          NEW.unit_cost
        ELSE
          (
            (public.re_inventory_stock.stock_actual * public.re_inventory_stock.weighted_avg_cost)
            + (NEW.quantity * NEW.unit_cost)
          )
          / (public.re_inventory_stock.stock_actual + NEW.quantity)
      END;

  -- 1C. OUT movement: validate stock then decrement
  ELSIF NEW.type = 'OUT' THEN
    -- Lock the stock row to prevent race conditions between concurrent OUTs
    SELECT stock_actual, weighted_avg_cost
    INTO v_current_stock, v_current_cost
    FROM public.re_inventory_stock
    WHERE branch_id  = NEW.branch_id
      AND warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id
    FOR UPDATE;

    IF v_current_stock IS NULL OR v_current_stock < NEW.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for OUT movement: available %, requested %',
        COALESCE(v_current_stock, 0), NEW.quantity;
    END IF;

    UPDATE public.re_inventory_stock
    SET stock_actual = stock_actual - NEW.quantity
    WHERE branch_id  = NEW.branch_id
      AND warehouse_id = NEW.warehouse_id
      AND product_id = NEW.product_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 2. TRIGGER: re_inventory_movements_stock
--    AFTER INSERT on re_inventory_movements
-- --------------------------------------------------------

DROP TRIGGER IF EXISTS trg_re_inventory_movements_stock
  ON public.re_inventory_movements;

CREATE TRIGGER trg_re_inventory_movements_stock
  AFTER INSERT ON public.re_inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.re_handle_inventory_movement();

-- --------------------------------------------------------
-- 3. TRIGGER FUNCTION: re_validate_transfer_in()
--    BEFORE INSERT on re_inventory_movements
--
-- Responsibility: reject TRANSFER_IN if no matching TRANSFER_OUT
-- exists for the same reference_id / reference_type='transfer'.
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_validate_transfer_in()
RETURNS TRIGGER AS $$
DECLARE
  v_transfer_out_exists BOOLEAN;
BEGIN
  IF NEW.reason_code = 'TRANSFER_IN' AND NEW.reference_type = 'transfer' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.re_inventory_movements
      WHERE reference_id   = NEW.reference_id
        AND reference_type = 'transfer'
        AND reason_code    = 'TRANSFER_OUT'
    ) INTO v_transfer_out_exists;

    IF NOT v_transfer_out_exists THEN
      RAISE EXCEPTION 'TRANSFER_IN requires a preceding TRANSFER_OUT for reference_id=%, reference_type=%',
        NEW.reference_id, NEW.reference_type;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 4. TRIGGER: re_inventory_movements_transfer_in
--    BEFORE INSERT on re_inventory_movements
-- --------------------------------------------------------

DROP TRIGGER IF EXISTS trg_re_inventory_movements_transfer_in
  ON public.re_inventory_movements;

CREATE TRIGGER trg_re_inventory_movements_transfer_in
  BEFORE INSERT ON public.re_inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.re_validate_transfer_in();

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
