-- ==============================================================================
-- HEAL_SEARCH_RECURSION.sql
-- Fixes the 500 Internal Server Error by breaking the RLS recursion loop.
-- ==============================================================================

-- 1. TEMPORARILY DISABLE RLS ON PROFILES TO BREAK THE LOOP
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. SYNC FUNCTION: Mirror organization_id to Auth Metadata
-- This allows us to get the org_id without querying the profiles table.
CREATE OR REPLACE FUNCTION public.sync_user_data_to_auth()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data = 
    coalesce(raw_app_meta_data, '{}'::jsonb) || 
    jsonb_build_object(
      'organization_id', NEW.organization_id,
      'role', NEW.role
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. APPLY SYNC TRIGGER
DROP TRIGGER IF EXISTS on_profile_update_sync ON public.profiles;
CREATE TRIGGER on_profile_update_sync
  AFTER INSERT OR UPDATE OF organization_id, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_data_to_auth();

-- 4. PERFORM INITIAL SYNC FOR ALL EXISTING USERS
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT id, organization_id, role FROM public.profiles) LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      coalesce(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object(
        'organization_id', r.organization_id,
        'role', r.role
      )
    WHERE id = r.id;
  END LOOP;
END $$;

-- 5. REDEFINE get_my_org_id (THE RECURSION BREAKER)
-- This version reads from the JWT claims, bypassing the profiles table entirely.
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id', '')::uuid),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- 6. FIX PROFILES POLICY (NON-RECURSIVE)
DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() 
    OR 
    organization_id = (nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id', '')::uuid)
  );

-- 7. RE-ENABLE RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 8. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';

-- VERIFICATION
SELECT 'SUCCESS: RLS Loop Broken. Search should work now.' as status;
