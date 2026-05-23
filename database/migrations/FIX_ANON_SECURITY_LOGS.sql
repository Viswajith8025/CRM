-- Fix Security Logs Insert Policy to allow anonymous users (unauthenticated users)
-- to log failed login attempts.

ALTER TABLE IF EXISTS public.security_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert security logs" ON public.security_logs;
DROP POLICY IF EXISTS "Anyone can insert security logs" ON public.security_logs;

CREATE POLICY "Anyone can insert security logs"
    ON public.security_logs
    FOR INSERT
    WITH CHECK (true);
