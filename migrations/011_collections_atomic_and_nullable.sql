-- ============================================================
-- MIGRATION: 011_collections_atomic_and_nullable.sql
-- Fix Warning #1: Atomic collection+items insertion via RPC
-- Fix Warning #4: total_collected_physical nullable per BR-COL-025
-- ============================================================

-- --------------------------------------------------------
-- 1.1 Make total_collected_physical nullable
-- --------------------------------------------------------

ALTER TABLE public.re_daily_settlements
  ALTER COLUMN total_collected_physical DROP NOT NULL;

-- Note: difference is GENERATED ALWAYS AS (total_collected_physical - total_expected)
-- When total_collected_physical is NULL, difference will also be NULL.
-- This is correct per BR-COL-025: physical count is null until supervisor evaluates.

-- --------------------------------------------------------
-- 1.2 Atomic collection registration function
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_register_collection(
  p_branch_id UUID,
  p_seller_id UUID,
  p_customer_id UUID,
  p_payment_method TEXT,
  p_reference_number TEXT,
  p_total_collected NUMERIC,
  p_items JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_collection_id UUID;
  v_item JSONB;
BEGIN
  -- Insert collection header
  INSERT INTO public.re_collections (
    branch_id,
    seller_id,
    customer_id,
    payment_method,
    reference_number,
    total_collected
  ) VALUES (
    p_branch_id,
    p_seller_id,
    p_customer_id,
    p_payment_method,
    p_reference_number,
    p_total_collected
  )
  RETURNING id INTO v_collection_id;

  -- Insert items atomically within same transaction
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.re_collection_items (
      collection_id,
      order_id,
      invoice_id,
      amount_applied
    ) VALUES (
      v_collection_id,
      (v_item->>'order_id')::UUID,
      NULLIF(v_item->>'invoice_id', '')::UUID,
      (v_item->>'amount_applied')::NUMERIC
    );
  END LOOP;

  RETURN v_collection_id;
END;
$$;

-- --------------------------------------------------------
-- 1.3 Atomic reversal creation function
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_create_reversal(
  p_original_collection_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original RECORD;
  v_reversal_id UUID;
  v_item RECORD;
BEGIN
  -- Fetch original collection
  SELECT * INTO v_original
  FROM public.re_collections
  WHERE id = p_original_collection_id;

  IF v_original IS NULL THEN
    RAISE EXCEPTION 'Original collection not found';
  END IF;

  -- Insert reversal collection (negative total)
  INSERT INTO public.re_collections (
    branch_id,
    seller_id,
    customer_id,
    payment_method,
    reference_number,
    total_collected,
    parent_collection_id
  ) VALUES (
    v_original.branch_id,
    v_original.seller_id,
    v_original.customer_id,
    v_original.payment_method,
    p_reason,
    -v_original.total_collected,
    v_original.id
  )
  RETURNING id INTO v_reversal_id;

  -- Insert reversal items (negative amounts)
  FOR v_item IN
    SELECT * FROM public.re_collection_items
    WHERE collection_id = p_original_collection_id
  LOOP
    INSERT INTO public.re_collection_items (
      collection_id,
      order_id,
      invoice_id,
      amount_applied
    ) VALUES (
      v_reversal_id,
      v_item.order_id,
      v_item.invoice_id,
      -v_item.amount_applied
    );
  END LOOP;

  RETURN v_reversal_id;
END;
$$;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
