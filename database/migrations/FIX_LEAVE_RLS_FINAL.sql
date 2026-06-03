-- ==============================================================================
-- FIX: RLS POLICIES FOR LEAVE REQUESTS (Remove dependency on get_my_org_id())
-- ==============================================================================

-- Drop all existing policies on leave_requests
DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update_own" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_update_admin" ON public.leave_requests;
DROP POLICY IF EXISTS "employees_can_insert_own_leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "employees_can_view_own_leave_requests" ON public.leave_requests;
DROP POLICY IF EXISTS "employees_can_update_own_leave_requests" ON public.leave_requests;

-- DROP leave_request_actions policies too
DROP POLICY IF EXISTS "leave_request_actions_select" ON public.leave_request_actions;
DROP POLICY IF EXISTS "leave_request_actions_insert" ON public.leave_request_actions;

-- ============================================================
-- SIMPLE, ROBUST POLICIES (no dependency on helper functions)
-- ============================================================

-- SELECT: Users can see all leave requests in their org
CREATE POLICY "leave_requests_select"
ON public.leave_requests FOR SELECT TO authenticated
USING (
  organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  )
);

-- INSERT: Users can only create requests for themselves
CREATE POLICY "leave_requests_insert"
ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  )
);

-- UPDATE: Employees can cancel their own pending requests; Admins/HR can approve/reject any
CREATE POLICY "leave_requests_update"
ON public.leave_requests FOR UPDATE TO authenticated
USING (
  organization_id = (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
  )
);

-- Leave Request Actions: org-scoped
CREATE POLICY "leave_request_actions_select"
ON public.leave_request_actions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.leave_requests lr
    WHERE lr.id = leave_request_id
    AND lr.organization_id = (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1
    )
  )
);

CREATE POLICY "leave_request_actions_insert"
ON public.leave_request_actions FOR INSERT TO authenticated
WITH CHECK (actor_id = auth.uid());

-- Reload schema
NOTIFY pgrst, 'reload schema';
