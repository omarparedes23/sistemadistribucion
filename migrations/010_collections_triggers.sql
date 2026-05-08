-- ============================================================
-- MIGRATION: 010_collections_triggers.sql
-- Collections & Daily Settlement triggers and constraint fixes
-- ============================================================

-- --------------------------------------------------------
-- 1.1 Relax CHECK constraints to allow negative reversal values
-- --------------------------------------------------------

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Drop any CHECK on re_collections that references total_collected
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.re_collections'::regclass
      AND contype = 'c'
      AND pg_get_expr(conbin, conrelid) LIKE '%total_collected%'
  LOOP
    EXECUTE format('ALTER TABLE public.re_collections DROP CONSTRAINT %I', r.conname);
  END LOOP;

  -- Drop any CHECK on re_collection_items that references amount_applied
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.re_collection_items'::regclass
      AND contype = 'c'
      AND pg_get_expr(conbin, conrelid) LIKE '%amount_applied%'
  LOOP
    EXECUTE format('ALTER TABLE public.re_collection_items DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

-- --------------------------------------------------------
-- 1.2 Append-only triggers on re_collections / re_collection_items
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_prevent_collections_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 're_collections is append-only: UPDATE is prohibited';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 're_collections is append-only: DELETE is prohibited';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_re_collections_append_only
  BEFORE UPDATE OR DELETE ON public.re_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.re_prevent_collections_mutation();

CREATE OR REPLACE FUNCTION public.re_prevent_collection_items_mutation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 're_collection_items is append-only: UPDATE is prohibited';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 're_collection_items is append-only: DELETE is prohibited';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_re_collection_items_append_only
  BEFORE UPDATE OR DELETE ON public.re_collection_items
  FOR EACH ROW
  EXECUTE FUNCTION public.re_prevent_collection_items_mutation();

-- --------------------------------------------------------
-- 1.3 total_expected trigger on re_collections INSERT
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_update_settlement_total_expected()
RETURNS TRIGGER AS $$
DECLARE
  v_settlement_date DATE;
  v_total NUMERIC(12,2);
BEGIN
  v_settlement_date := (NEW.collected_at AT TIME ZONE 'America/Lima')::DATE;

  SELECT COALESCE(SUM(total_collected), 0) INTO v_total
  FROM public.re_collections
  WHERE branch_id = NEW.branch_id
    AND seller_id = NEW.seller_id
    AND (collected_at AT TIME ZONE 'America/Lima')::DATE = v_settlement_date;

  UPDATE public.re_daily_settlements
  SET total_expected = v_total
  WHERE branch_id = NEW.branch_id
    AND seller_id = NEW.seller_id
    AND settlement_date = v_settlement_date
    AND status = 'PENDING';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_re_collections_settlement_total
  AFTER INSERT ON public.re_collections
  FOR EACH ROW
  EXECUTE FUNCTION public.re_update_settlement_total_expected();

-- Also initialise total_expected when a settlement is created after collections exist
CREATE OR REPLACE FUNCTION public.re_init_settlement_total_expected()
RETURNS TRIGGER AS $$
DECLARE
  v_total NUMERIC(12,2);
BEGIN
  SELECT COALESCE(SUM(total_collected), 0) INTO v_total
  FROM public.re_collections
  WHERE branch_id = NEW.branch_id
    AND seller_id = NEW.seller_id
    AND (collected_at AT TIME ZONE 'America/Lima')::DATE = NEW.settlement_date;

  NEW.total_expected := v_total;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_re_daily_settlements_init_total
  BEFORE INSERT ON public.re_daily_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.re_init_settlement_total_expected();

-- --------------------------------------------------------
-- 1.4 Replace payment_status trigger with INSERT-only version
-- --------------------------------------------------------

DROP TRIGGER IF EXISTS trg_re_collection_items_payment_status ON public.re_collection_items;

CREATE TRIGGER trg_re_collection_items_payment_status
  AFTER INSERT ON public.re_collection_items
  FOR EACH ROW
  EXECUTE FUNCTION public.re_update_order_payment_status();

-- --------------------------------------------------------
-- 1.5 Settlement immutability trigger (APPROVED / DISCREPANCY)
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.re_prevent_settlement_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('APPROVED', 'DISCREPANCY') THEN
    RAISE EXCEPTION 'Settlement is immutable once APPROVED or DISCREPANCY';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_re_daily_settlements_immutable
  BEFORE UPDATE ON public.re_daily_settlements
  FOR EACH ROW
  EXECUTE FUNCTION public.re_prevent_settlement_update();

-- --------------------------------------------------------
-- 1.6 Extend cancellation audit log enum for collections
-- --------------------------------------------------------

ALTER TYPE public.re_cancellation_doc_type ADD VALUE IF NOT EXISTS 'collection';

-- ============================================================
-- END OF MIGRATION
-- ============================================================
