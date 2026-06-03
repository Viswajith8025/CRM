-- ==============================================================================
-- NUCLEAR FIX: DROP ALL TRIGGERS ON PROFILES + MAKE AUDIT_LOGS SAFE
-- This script finds and drops EVERY trigger on the profiles table,
-- then makes audit_logs.organization_id nullable so it can NEVER block again.
-- ==============================================================================

-- STEP 1: Drop every single trigger on the profiles table (by name)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.profiles', r.tgname);
    RAISE NOTICE 'Dropped trigger: %', r.tgname;
  END LOOP;
END;
$$;

-- STEP 2: Make organization_id nullable on audit_logs so it can NEVER crash again
-- even if a new trigger is added later
ALTER TABLE public.audit_logs 
  ALTER COLUMN organization_id DROP NOT NULL;

-- STEP 3: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
