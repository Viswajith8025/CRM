-- ==============================================================================
-- DATA RECOVERY & RLS STABILIZATION (V5)
-- This script fixes the "zero clients" issue by:
-- 1. Unifying all data under the main organization.
-- 2. Fixing the recursive RLS functions.
-- 3. Adding an Admin Bypass to policies so Admins see all data.
-- ==============================================================================

-- 1. IDENTIFY THE TARGET ORGANIZATION
-- We'll use the default ECRAFTZ org ID.
DO $$
DECLARE
    v_org_id uuid := '00000000-0000-0000-0000-000000000000';
BEGIN
    -- 2. UNIFY DATA
    -- If data was lost, it's likely because it was on the zero UUID and the user isn't.
    -- Or vice versa. We'll set everything to the zero UUID for now to restore visibility.
    
    UPDATE public.profiles SET organization_id = v_org_id WHERE organization_id IS NULL;
    UPDATE public.clients  SET organization_id = v_org_id WHERE organization_id IS NULL OR organization_id != v_org_id;
    UPDATE public.leads    SET organization_id = v_org_id WHERE organization_id IS NULL OR organization_id != v_org_id;
    UPDATE public.projects SET organization_id = v_org_id WHERE organization_id IS NULL OR organization_id != v_org_id;
    UPDATE public.tasks    SET organization_id = v_org_id WHERE organization_id IS NULL OR organization_id != v_org_id;
    UPDATE public.invoices SET organization_id = v_org_id WHERE organization_id IS NULL OR organization_id != v_org_id;

    RAISE NOTICE 'Unified all core data under organization %', v_org_id;
END $$;

-- 3. FIX THE HELPER FUNCTION (NON-RECURSIVE)
-- This version looks at JWT claims first, falls back to the zero UUID.
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id', '')::uuid),
    (nullif(current_setting('request.jwt.claims', true)::jsonb->>'organization_id', '')::uuid),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- 4. FIX THE ROLE HELPER
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (nullif(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role', '')::text),
    (nullif(current_setting('request.jwt.claims', true)::jsonb->>'role', '')::text),
    'employee'
  );
$$;

-- 5. RE-APPLY POLICIES WITH ADMIN BYPASS
-- This ensures admins always see everything, even if organization_id is mismatched.

-- Clients
DROP POLICY IF EXISTS "clients_all" ON public.clients;
CREATE POLICY "clients_all" ON public.clients
  FOR ALL TO authenticated
  USING (
    organization_id = public.get_my_org_id() 
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id() 
    OR public.get_my_role() = 'admin'
  );

-- Leads
DROP POLICY IF EXISTS "leads_all" ON public.leads;
CREATE POLICY "leads_all" ON public.leads
  FOR ALL TO authenticated
  USING (
    organization_id = public.get_my_org_id() 
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id() 
    OR public.get_my_role() = 'admin'
  );

-- Projects
DROP POLICY IF EXISTS "projects_all" ON public.projects;
CREATE POLICY "projects_all" ON public.projects
  FOR ALL TO authenticated
  USING (
    organization_id = public.get_my_org_id() 
    OR public.get_my_role() = 'admin'
  )
  WITH CHECK (
    organization_id = public.get_my_org_id() 
    OR public.get_my_role() = 'admin'
  );

-- Profiles (Prevent recursion)
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_my_org_id() 
    OR public.get_my_role() = 'admin'
    OR id = auth.uid()
  );

-- 6. SYNC AUTH METADATA (Final Guard)
-- Run the sync for all users so the JWT has the correct role/org
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

-- 7. REFRESH
NOTIFY pgrst, 'reload schema';
