-- ==============================================================================
-- MIGRATION: Fix RLS Policies for leave_request_actions Table (403 Forbidden Fix)
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- 1. Ensure RLS is active on leave_request_actions
ALTER TABLE public.leave_request_actions ENABLE ROW LEVEL SECURITY;

-- 2. Drop any legacy/incomplete policies
DROP POLICY IF EXISTS "Users can view actions for accessible requests" ON public.leave_request_actions;
DROP POLICY IF EXISTS "Users can create actions for accessible requests" ON public.leave_request_actions;
DROP POLICY IF EXISTS "Users can select leave request actions" ON public.leave_request_actions;
DROP POLICY IF EXISTS "Users can insert leave request actions" ON public.leave_request_actions;

-- 3. Create SELECT policy (Uses leave_requests RLS boundary implicitly)
CREATE POLICY "Users can select leave request actions"
    ON public.leave_request_actions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.leave_requests lr
            WHERE lr.id = leave_request_actions.leave_request_id
        )
    );

-- 4. Create INSERT policy (Allows owner or authorized managers to submit action logs)
CREATE POLICY "Users can insert leave request actions"
    ON public.leave_request_actions FOR INSERT
    WITH CHECK (
        actor_id = auth.uid() AND (
            EXISTS (
                SELECT 1 FROM public.leave_requests lr
                WHERE lr.id = leave_request_actions.leave_request_id AND (
                    lr.user_id = auth.uid() -- Employee doing actions on their own request (e.g. cancel)
                    OR public.has_permission('leave.approval.manage') -- Admin/HR managing approval workflow
                )
            )
        )
    );

-- 5. Force schema cache refresh
NOTIFY pgrst, 'reload schema';
