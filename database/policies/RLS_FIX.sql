-- ==============================================================================
-- ENTERPRISE RLS HEALER (V4 - BREAK THE DEADLOCK)
-- This version temporarily disables RLS to fix the recursion once and for all.
-- ==============================================================================

-- 1. BREAK THE LOOP IMMEDIATELY
-- We disable RLS on the profiles table so we can actually query it to fix it.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 2. NUCLEAR RESET: Drop ALL existing policies on profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
  END LOOP;
END $$;

-- 3. DATA SYNC: Mirror role AND organization_id to Auth Metadata
-- This works now because RLS is disabled on profiles.
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

-- 4. APPLY SYNC TRIGGER
DROP TRIGGER IF EXISTS on_profile_update_sync ON public.profiles;
CREATE TRIGGER on_profile_update_sync
  AFTER INSERT OR UPDATE OF organization_id, role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_data_to_auth();

-- 5. PERFORM INITIAL SYNC (The "Heal" step)
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

-- 6. RE-APPLY THE ULTIMATE NON-RECURSIVE POLICY
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid() -- You can always see yourself
    OR 
    (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') IN ('super_admin', 'admin') -- Admins see all
    OR
    organization_id = (nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id', '')::uuid) -- Org isolation
  );

-- 7. RE-ENABLE RLS (Safe now because the policy is no longer recursive)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 8. CLEANUP HELPER
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id', '')::uuid),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- 9. REFRESH SCHEMA
NOTIFY pgrst, 'reload schema';
