-- ==============================================================================
-- AUTHENTICATION RATE LIMITING & AUDIT SCHEMA
-- Prevents brute force attacks and logs sensitive auth events
-- ==============================================================================

-- 1. Table to track authentication events (unauthenticated)
-- Note: We use a separate table for login attempts to avoid polluting the 'activities' table
-- with thousands of failed brute force attempts.
CREATE TABLE IF NOT EXISTS public.auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  event_type TEXT NOT NULL, -- 'LOGIN_ATTEMPT', 'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOCKOUT'
  is_success BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Performance: Targeted indexes for lockout checks
CREATE INDEX IF NOT EXISTS idx_auth_events_email_created ON public.auth_events (email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_events_ip_created ON public.auth_events (ip_address, created_at DESC);

-- 3. Security: RLS for auth_events
-- Only system/authenticated users with high privileges can view these logs
ALTER TABLE public.auth_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_view_auth_events" ON public.auth_events
  FOR SELECT TO authenticated
  USING ((current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'super_admin');

-- Allow unauthenticated inserts for logging attempts (rate limited by DB/IP)
CREATE POLICY "public_insert_auth_events" ON public.auth_events
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- 4. FUNCTION: Check for brute-force lockout
-- Returns lockout status and remaining cooldown
CREATE OR REPLACE FUNCTION public.check_auth_lockout(p_email TEXT, p_ip TEXT)
RETURNS TABLE (is_locked BOOLEAN, remaining_seconds INT, message TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to check private logs
AS $$
DECLARE
    recent_failures INT;
    lockout_window INTERVAL := INTERVAL '15 minutes';
    max_attempts INT := 5;
    last_failure_time TIMESTAMPTZ;
BEGIN
    -- Normalize email to prevent trivial bypasses
    p_email := lower(trim(p_email));

    -- Count consecutive failures in the last 15 minutes for this email or IP
    -- We look for the number of failures since the last successful login
    SELECT COUNT(*) INTO recent_failures
    FROM (
        SELECT is_success, created_at
        FROM public.auth_events
        WHERE (email = p_email OR ip_address = p_ip)
          AND created_at > now() - lockout_window
        ORDER BY created_at DESC
        LIMIT max_attempts
    ) attempts
    WHERE is_success = false;

    IF recent_failures >= max_attempts THEN
        -- Get the time of the most recent failure to calculate cooldown
        SELECT created_at INTO last_failure_time
        FROM public.auth_events
        WHERE (email = p_email OR ip_address = p_ip)
          AND is_success = false
        ORDER BY created_at DESC
        LIMIT 1;

        RETURN QUERY SELECT 
            true, 
            GREATEST(0, EXTRACT(EPOCH FROM (last_failure_time + lockout_window - now()))::INT),
            format('Security Alert: Too many failed attempts. Account temporarily locked for %s seconds for security.', 
                   EXTRACT(EPOCH FROM (last_failure_time + lockout_window - now()))::INT)::TEXT;
    ELSE
        RETURN QUERY SELECT false, 0, ''::TEXT;
    END IF;
END;
$$;

-- 5. FUNCTION: Cleanup old auth logs to prevent table bloat
CREATE OR REPLACE FUNCTION public.cleanup_auth_events()
RETURNS VOID AS $$
BEGIN
    DELETE FROM public.auth_events WHERE created_at < now() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.check_auth_lockout(TEXT, TEXT) TO anon, authenticated;

-- ==============================================================================
-- DONE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
