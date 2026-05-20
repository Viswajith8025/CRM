-- SECURITY LOGS RLS HARDENING
-- Allows all authenticated users to write to security logs (required for rate limiting)
-- but ensures only admins can read them.

ALTER TABLE IF EXISTS public.security_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert security logs" ON public.security_logs;
CREATE POLICY "Users can insert security logs"
    ON public.security_logs
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

DROP POLICY IF EXISTS "Only admins can view security logs" ON public.security_logs;
CREATE POLICY "Only admins can view security logs"
    ON public.security_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
        )
    );
