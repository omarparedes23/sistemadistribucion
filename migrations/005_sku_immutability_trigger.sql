-- ============================================================
-- MIGRATION: 005_sku_immutability_trigger.sql
-- Project: Sistema de Reparto (prefix: re_)
-- Enforces BR-CM-005: SKU is immutable after the first inventory
-- movement (or order item) referencing the product.
--
-- If you need to change a SKU, create a new product and deactivate
-- the old one. Historical records remain intact.
-- ============================================================

CREATE OR REPLACE FUNCTION public.re_prevent_sku_change_after_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Allow if SKU is not actually changing
  IF NEW.sku = OLD.sku THEN
    RETURN NEW;
  END IF;

  -- Block if any inventory_movement references this product
  IF EXISTS (
    SELECT 1 FROM public.re_inventory_movements
    WHERE product_id = OLD.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'SKU_CANNOT_CHANGE: Product SKU is immutable after the first inventory movement (BR-CM-005). Old SKU=%, New SKU=%', OLD.sku, NEW.sku;
  END IF;

  -- Block if any order_item references this product
  IF EXISTS (
    SELECT 1 FROM public.re_order_items
    WHERE product_id = OLD.id
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'SKU_CANNOT_CHANGE: Product SKU is immutable after being used in an order (BR-CM-005). Old SKU=%, New SKU=%', OLD.sku, NEW.sku;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS trg_re_products_sku_immutable ON public.re_products;

CREATE TRIGGER trg_re_products_sku_immutable
  BEFORE UPDATE ON public.re_products
  FOR EACH ROW
  EXECUTE FUNCTION public.re_prevent_sku_change_after_transaction();

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
