-- ============================================================
-- MIGRATION: 007_pricing_triggers.sql
-- Project: Sistema de Reparto (prefix: re_)
-- Phase 1: Foundation — Pricing triggers & validation
-- Stack: Supabase (PostgreSQL 15+)
-- ============================================================

-- --------------------------------------------------------
-- 1. TRIGGER FUNCTION: re_price_list_default_unique()
--    BEFORE INSERT OR UPDATE on re_price_lists
--
-- Responsibilities:
--   - Ensure at most one is_default=true per branch_id
--   - When a row is set to is_default=true, unset all others
--     in the same branch
--   - Reject is_default=true on inactive price lists
--   - When active is set to false, also unset is_default
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_price_list_default_unique()
RETURNS TRIGGER AS $$
BEGIN
  -- Reject setting is_default=true on an inactive price list
  IF NEW.is_default = true AND NEW.active = false THEN
    RAISE EXCEPTION 'PRICE_LIST_INACTIVE: a default price list must be active (branch_id=%, id=%)',
      NEW.branch_id, NEW.id;
  END IF;

  -- If active is being set to false and is_default is true, unset is_default
  IF NEW.active = false AND NEW.is_default = true THEN
    NEW.is_default := false;
  END IF;

  -- When setting is_default=true, unset all other default lists in the same branch
  IF NEW.is_default = true THEN
    UPDATE public.re_price_lists
    SET is_default = false
    WHERE branch_id = NEW.branch_id
      AND id <> NEW.id
      AND is_default = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 2. TRIGGER: trg_re_price_lists_default_unique
--    BEFORE INSERT OR UPDATE on re_price_lists
-- --------------------------------------------------------

DROP TRIGGER IF EXISTS trg_re_price_lists_default_unique
  ON public.re_price_lists;

CREATE TRIGGER trg_re_price_lists_default_unique
  BEFORE INSERT OR UPDATE ON public.re_price_lists
  FOR EACH ROW
  EXECUTE FUNCTION public.re_price_list_default_unique();

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
