-- ============================================================
-- MIGRATION: 003_missing_tables.sql
-- Project: Sistema de Reparto (prefix: re_)
-- Fixes gaps found after reviewing all specs:
--   1. re_sunat_status ENUM — missing values per BR-SNAT-046
--   2. re_profiles        — driver name + DNI for GRE XML (BR-SNAT-012)
--   3. re_branch_document_series — multi-serie support (BR-SNAT-043)
--   4. re_cancellation_audit_log — fiscal annulment audit (BR-SNAT-035/036)
-- ============================================================

-- --------------------------------------------------------
-- 1. EXTEND re_sunat_status ENUM
-- Missing values per BR-SNAT-046:
--   WAITING_FOR_INVOICE — credit note waiting for invoice ACEPTADO
--   ANULACION_PENDIENTE — annulment submitted, awaiting OSE confirmation
--   ANULADO             — successfully annulled by SUNAT
-- --------------------------------------------------------

ALTER TYPE re_sunat_status ADD VALUE IF NOT EXISTS 'WAITING_FOR_INVOICE';
ALTER TYPE re_sunat_status ADD VALUE IF NOT EXISTS 'ANULACION_PENDIENTE';
ALTER TYPE re_sunat_status ADD VALUE IF NOT EXISTS 'ANULADO';

-- --------------------------------------------------------
-- 2. re_profiles
-- Stores name, DNI, and role metadata for system users.
-- Required because auth.users only carries email — the GRE XML (BR-SNAT-012)
-- MUST include driver full_name and document_number.
-- Also used to store role + branch_id for RLS helper functions
-- instead of relying solely on JWT metadata.
-- --------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.re_profiles (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       TEXT NOT NULL,
  document_type   TEXT NOT NULL DEFAULT 'DNI' CHECK (document_type IN ('DNI','CE','PASAPORTE')),
  document_number TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin','supervisor','seller','driver','assistant')),
  branch_id       UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  company_id      UUID NOT NULL REFERENCES public.re_companies(id) ON DELETE RESTRICT,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_re_profiles_branch ON public.re_profiles(branch_id);
CREATE INDEX IF NOT EXISTS idx_re_profiles_role   ON public.re_profiles(role);

ALTER TABLE public.re_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read profiles in their own branch
CREATE POLICY re_profiles_select ON public.re_profiles
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

-- Only admin can create/update profiles
CREATE POLICY re_profiles_insert ON public.re_profiles
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id() AND public.re_is_admin()
  );

CREATE POLICY re_profiles_update ON public.re_profiles
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id() AND public.re_is_admin()
  );

-- Users can always read their own profile (for JWT bootstrap)
CREATE POLICY re_profiles_select_own ON public.re_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY re_profiles_delete ON public.re_profiles
  FOR DELETE USING (false);

-- updated_at trigger
CREATE TRIGGER trg_re_profiles_updated_at
  BEFORE UPDATE ON public.re_profiles
  FOR EACH ROW EXECUTE FUNCTION public.re_handle_updated_at();

-- --------------------------------------------------------
-- 3. re_branch_document_series
-- Stores additional document series per branch (BR-SNAT-043).
-- Primary series (F001, B001, T001) live in re_branches columns.
-- This table handles branches that need multiple series
-- (e.g., F001 + F002, or T001 + T002 for high-volume branches).
-- --------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE re_document_series_type AS ENUM ('GRE','FACTURA','BOLETA','NOTA_CREDITO');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.re_branch_document_series (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  document_type re_document_series_type NOT NULL,
  serie         TEXT NOT NULL,
  is_primary    BOOLEAN NOT NULL DEFAULT false,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(branch_id, document_type, serie),
  -- SUNAT serie format: first char = doc type letter, then 3 digits (T001, F001, B001)
  CONSTRAINT chk_re_serie_format CHECK (serie ~ '^[A-Z][0-9]{3}$')
);

ALTER TABLE public.re_branch_document_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY re_branch_document_series_select ON public.re_branch_document_series
  FOR SELECT USING (branch_id = public.re_auth_branch_id());

CREATE POLICY re_branch_document_series_insert ON public.re_branch_document_series
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id() AND public.re_is_admin()
  );

CREATE POLICY re_branch_document_series_update ON public.re_branch_document_series
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id() AND public.re_is_admin()
  );

CREATE POLICY re_branch_document_series_delete ON public.re_branch_document_series
  FOR DELETE USING (false);

CREATE TRIGGER trg_re_branch_document_series_updated_at
  BEFORE UPDATE ON public.re_branch_document_series
  FOR EACH ROW EXECUTE FUNCTION public.re_handle_updated_at();

-- --------------------------------------------------------
-- 4. re_cancellation_audit_log
-- Append-only audit log for fiscal document annulments (BR-SNAT-035/036).
-- Tracks who requested annulment, the motivo, and OSE confirmation.
-- DELETE is prohibited. UPDATE is allowed only for OSE confirmation fields
-- (ose_status, ose_confirmed_at) — see BR-SNAT-037.
-- --------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE re_cancellation_doc_type AS ENUM ('invoice','credit_note','remission_guide');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.re_cancellation_audit_log (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL,
  document_type    re_cancellation_doc_type NOT NULL,
  branch_id        UUID NOT NULL REFERENCES public.re_branches(id) ON DELETE RESTRICT,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  motivo           TEXT NOT NULL CHECK (length(motivo) >= 15),
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  ose_status       TEXT,
  ose_confirmed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_re_cancellation_log_document
  ON public.re_cancellation_audit_log(document_id, document_type);
CREATE INDEX IF NOT EXISTS idx_re_cancellation_log_branch
  ON public.re_cancellation_audit_log(branch_id);

-- Block DELETE (append-only per BR-SNAT-036)
CREATE OR REPLACE FUNCTION public.re_prevent_cancellation_log_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 're_cancellation_audit_log is append-only: DELETE is prohibited';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_re_cancellation_log_no_delete
  BEFORE DELETE ON public.re_cancellation_audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.re_prevent_cancellation_log_delete();

ALTER TABLE public.re_cancellation_audit_log ENABLE ROW LEVEL SECURITY;

-- Supervisor+ can read annulment logs for their branch
CREATE POLICY re_cancellation_log_select ON public.re_cancellation_audit_log
  FOR SELECT USING (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_supervisor_or_above()
  );

-- Insert: admin only (annulment is admin-only per BR-SNAT-034)
CREATE POLICY re_cancellation_log_insert ON public.re_cancellation_audit_log
  FOR INSERT WITH CHECK (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_admin()
  );

-- Update: only OSE confirmation fields (ose_status, ose_confirmed_at)
-- Done by service_role (Edge Function) — no user-level policy needed
-- Admin can update for OSE confirmation write-back
CREATE POLICY re_cancellation_log_update ON public.re_cancellation_audit_log
  FOR UPDATE USING (
    branch_id = public.re_auth_branch_id()
    AND public.re_is_admin()
  );

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
