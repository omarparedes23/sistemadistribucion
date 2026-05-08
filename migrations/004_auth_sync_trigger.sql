-- ============================================================
-- MIGRATION: 004_auth_sync_trigger.sql
-- Project: Sistema de Reparto (prefix: re_)
-- Syncs re_profiles changes to auth.users.raw_user_meta_data
-- so RLS helper functions (re_auth_role, re_auth_branch_id)
-- read from JWT without relying on external metadata injection.
--
-- NOTE: This function uses SECURITY DEFINER so it can write
-- to auth.users. Run this in the Supabase SQL Editor as postgres.
-- ============================================================

CREATE OR REPLACE FUNCTION public.re_sync_profile_to_jwt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
    || jsonb_build_object(
         'role', NEW.role,
         'branch_id', NEW.branch_id::text,
         'company_id', NEW.company_id::text,
         'full_name', NEW.full_name
       )
  WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS trg_re_sync_profile_to_jwt ON public.re_profiles;

CREATE TRIGGER trg_re_sync_profile_to_jwt
  AFTER INSERT OR UPDATE OF role, branch_id, company_id, full_name
  ON public.re_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.re_sync_profile_to_jwt();

-- Also sync on INSERT via a one-time backfill for existing profiles
-- (safe to run multiple times, only affects rows where JWT metadata is stale)
UPDATE auth.users u
SET raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object(
       'role', p.role,
       'branch_id', p.branch_id::text,
       'company_id', p.company_id::text,
       'full_name', p.full_name
     )
FROM public.re_profiles p
WHERE u.id = p.id;

-- --------------------------------------------------------
-- END OF MIGRATION
-- --------------------------------------------------------
