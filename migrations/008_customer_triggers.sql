-- ============================================================
-- MIGRATION: 008_customer_triggers.sql
-- Project: Sistema de Reparto (prefix: re_)
-- Phase 1: Foundation — Customer triggers & validation
-- Stack: Supabase (PostgreSQL 15+)
-- ============================================================

-- --------------------------------------------------------
-- 1. TRIGGER FUNCTION: re_validate_customer_document()
--    BEFORE INSERT OR UPDATE on re_customers
--
-- Responsibilities:
--   - Validate ruc_or_dni is RUC (exactly 11 digits) or DNI (exactly 8 digits)
--   - Reject everything else with a clear error message
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_validate_customer_document()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ruc_or_dni ~ '^[0-9]{11}$' THEN
    RETURN NEW;
  ELSIF NEW.ruc_or_dni ~ '^[0-9]{8}$' THEN
    RETURN NEW;
  ELSE
    RAISE EXCEPTION 'INVALID_DOCUMENT: ruc_or_dni must be RUC (11 digits) or DNI (8 digits), got %',
      NEW.ruc_or_dni;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 2. TRIGGER: trg_re_customers_validate_document
--    BEFORE INSERT OR UPDATE on re_customers
-- --------------------------------------------------------

DROP TRIGGER IF EXISTS trg_re_customers_validate_document
  ON public.re_customers;

CREATE TRIGGER trg_re_customers_validate_document
  BEFORE INSERT OR UPDATE ON public.re_customers
  FOR EACH ROW
  EXECUTE FUNCTION public.re_validate_customer_document();

-- --------------------------------------------------------
-- 3. TRIGGER FUNCTION: re_customer_addresses_primary_unique()
--    BEFORE INSERT OR UPDATE on re_customer_addresses
--
-- Responsibilities:
--   - Ensure at most one is_primary=true per customer_id
--   - When a row is set to is_primary=true, unset all others
--     for the same customer
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_customer_addresses_primary_unique()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.re_customer_addresses
    SET is_primary = false
    WHERE customer_id = NEW.customer_id
      AND id <> NEW.id
      AND is_primary = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- --------------------------------------------------------
-- 4. TRIGGER: trg_re_customer_addresses_primary_unique
--    BEFORE INSERT OR UPDATE on re_customer_addresses
-- --------------------------------------------------------

DROP TRIGGER IF EXISTS trg_re_customer_addresses_primary_unique
  ON public.re_customer_addresses;

CREATE TRIGGER trg_re_customer_addresses_primary_unique
  BEFORE INSERT OR UPDATE ON public.re_customer_addresses
  FOR EACH ROW
  EXECUTE FUNCTION public.re_customer_addresses_primary_unique();

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
