-- ==============================================================================
-- DEFINITIVE FIX: Run each block separately in the SQL Editor
-- ==============================================================================

-- BLOCK 1: Check if PostgREST can see the table in its schema
-- (If this returns a row, the table IS in the schema cache)
SELECT schemaname, tablename, tableowner
FROM pg_tables
WHERE tablename = 'leave_requests';

-- BLOCK 2: Check current RLS policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'leave_requests';

-- BLOCK 3: Check GRANTs
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'leave_requests';

-- BLOCK 4: Nuke and rebuild ALL policies cleanly
DO $$
BEGIN
  -- Drop all existing policies
  EXECUTE 'DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests';
  EXECUTE 'DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests';
  EXECUTE 'DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests';
  EXECUTE 'DROP POLICY IF EXISTS "leave_requests_update_own" ON public.leave_requests';
  EXECUTE 'DROP POLICY IF EXISTS "leave_requests_update_admin" ON public.leave_requests';
  EXECUTE 'DROP POLICY IF EXISTS "employees_can_insert_own_leave_requests" ON public.leave_requests';
  EXECUTE 'DROP POLICY IF EXISTS "employees_can_view_own_leave_requests" ON public.leave_requests';
  EXECUTE 'DROP POLICY IF EXISTS "employees_can_update_own_leave_requests" ON public.leave_requests';
END $$;

-- Re-enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Permissive INSERT: just check it's the logged-in user
CREATE POLICY "leave_requests_insert"
ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Permissive SELECT: see your own
CREATE POLICY "leave_requests_select"
ON public.leave_requests FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- Permissive UPDATE: org scoped
CREATE POLICY "leave_requests_update"
ON public.leave_requests FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.profiles
  WHERE id = auth.uid()
  AND organization_id = leave_requests.organization_id
  AND role IN ('super_admin','admin','hr')
));

-- Re-grant
GRANT SELECT, INSERT, UPDATE ON public.leave_requests TO authenticated;
GRANT SELECT ON public.leave_types TO authenticated;

-- Hard reload
NOTIFY pgrst, 'reload schema';
