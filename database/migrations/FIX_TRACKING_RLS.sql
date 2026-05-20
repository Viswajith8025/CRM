-- WORKFORCE TRACKING RLS HARDENING
-- Ensures employees can manage their own sessions and admins can monitor them

-- 1. Work Sessions Policies
DROP POLICY IF EXISTS "Users can manage their own work sessions" ON public.work_sessions;
CREATE POLICY "Users can manage their own work sessions"
    ON public.work_sessions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all work sessions" ON public.work_sessions;
CREATE POLICY "Admins can view all work sessions"
    ON public.work_sessions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND organization_id = public.work_sessions.organization_id
        )
    );

-- 2. Break Sessions Policies
DROP POLICY IF EXISTS "Users can manage their own break sessions" ON public.break_sessions;
CREATE POLICY "Users can manage their own break sessions"
    ON public.break_sessions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all break sessions" ON public.break_sessions;
CREATE POLICY "Admins can view all break sessions"
    ON public.break_sessions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND organization_id = public.break_sessions.organization_id
        )
    );
