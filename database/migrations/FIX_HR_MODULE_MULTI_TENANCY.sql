-- ==============================================================================
-- FIX HR MODULE: LEAVE REQUESTS MULTI-TENANCY & RLS
-- ==============================================================================

-- 1. Ensure organization_id exists on HR tables
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.leave_balances ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.leave_types    ADD COLUMN IF NOT EXISTS organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';

-- 2. Backfill existing data
UPDATE public.leave_requests SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.leave_balances SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE public.leave_types    SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;

-- 3. Enable RLS
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

-- 4. Create proper RLS Policies for Multi-Tenancy

-- LEAVE TYPES
DROP POLICY IF EXISTS "leave_types_select" ON public.leave_types;
CREATE POLICY "leave_types_select" ON public.leave_types
  FOR SELECT TO authenticated USING (true); -- Everyone can see active leave types

-- LEAVE BALANCES
DROP POLICY IF EXISTS "leave_balances_select" ON public.leave_balances;
CREATE POLICY "leave_balances_select" ON public.leave_balances
  FOR SELECT TO authenticated USING (
    organization_id = public.get_my_org_id()
  );

DROP POLICY IF EXISTS "leave_balances_all" ON public.leave_balances;
CREATE POLICY "leave_balances_all" ON public.leave_balances
  FOR ALL TO authenticated USING (
    organization_id = public.get_my_org_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr'))
  );

-- LEAVE REQUESTS
DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
CREATE POLICY "leave_requests_select" ON public.leave_requests
  FOR SELECT TO authenticated USING (
    organization_id = public.get_my_org_id()
  );

DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
CREATE POLICY "leave_requests_insert" ON public.leave_requests
  FOR INSERT TO authenticated WITH CHECK (
    user_id = auth.uid() AND organization_id = public.get_my_org_id()
  );

DROP POLICY IF EXISTS "leave_requests_update_own" ON public.leave_requests;
CREATE POLICY "leave_requests_update_own" ON public.leave_requests
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid() AND status = 'pending' AND organization_id = public.get_my_org_id()
  );

DROP POLICY IF EXISTS "leave_requests_update_admin" ON public.leave_requests;
CREATE POLICY "leave_requests_update_admin" ON public.leave_requests
  FOR UPDATE TO authenticated USING (
    organization_id = public.get_my_org_id() AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'hr'))
  );

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
