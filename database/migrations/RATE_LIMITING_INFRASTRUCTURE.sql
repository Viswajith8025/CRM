
-- ==============================================================================
-- ENTERPRISE RATE LIMITING & SECURITY INFRASTRUCTURE
-- ==============================================================================
-- Implements IP and User-based rate limiting for public and internal endpoints.

-- 1. RATE LIMITS TRACKING TABLE
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL, -- Format: 'type:identifier:action' (e.g., 'ip:1.2.3.4:login' or 'user:uuid:create_project')
    hits INT DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(key)
);

-- Index for cleanup and lookup
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON public.rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON public.rate_limits(expires_at);

-- 2. RATE LIMIT CHECKER FUNCTION
-- Returns JSONB with status, remaining hits, and reset time.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_key TEXT,
    p_max_hits INT,
    p_window_seconds INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_now TIMESTAMPTZ := now();
    v_record RECORD;
    v_remaining INT;
    v_reset_in INT;
BEGIN
    -- Cleanup expired entries periodically (randomized to avoid lock contention)
    IF random() < 0.01 THEN
        DELETE FROM public.rate_limits WHERE expires_at < v_now;
    END IF;

    -- Upsert the rate limit record
    INSERT INTO public.rate_limits (key, expires_at)
    VALUES (p_key, v_now + (p_window_seconds || ' seconds')::INTERVAL)
    ON CONFLICT (key) DO UPDATE
    SET hits = CASE 
        WHEN rate_limits.expires_at < v_now THEN 1 -- Reset if window expired
        ELSE rate_limits.hits + 1 
    END,
    window_start = CASE 
        WHEN rate_limits.expires_at < v_now THEN v_now 
        ELSE rate_limits.window_start 
    END,
    expires_at = CASE 
        WHEN rate_limits.expires_at < v_now THEN v_now + (p_window_seconds || ' seconds')::INTERVAL
        ELSE rate_limits.expires_at 
    END
    RETURNING * INTO v_record;

    v_remaining := p_max_hits - v_record.hits;
    v_reset_in := EXTRACT(EPOCH FROM (v_record.expires_at - v_now))::INT;

    IF v_record.hits > p_max_hits THEN
        RETURN jsonb_build_object(
            'allowed', false,
            'remaining', 0,
            'limit', p_max_hits,
            'reset_after', v_reset_in,
            'message', 'Too many requests. Please try again in ' || v_reset_in || ' seconds.'
        );
    ELSE
        RETURN jsonb_build_object(
            'allowed', true,
            'remaining', v_remaining,
            'limit', p_max_hits,
            'reset_after', v_reset_in
        );
    END IF;
END;
$$;

-- 3. GLOBAL INPUT SANITIZATION HELPERS
CREATE OR REPLACE FUNCTION public.sanitize_text(p_text TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Basic XSS prevention: strip HTML tags and trim whitespace
    -- In a real app, you might use a more sophisticated extension or regex
    RETURN trim(regexp_replace(p_text, '<[^>]*>', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. HARDEN PROFILES WITH INPUT VALIDATION
-- Ensure no one can set themselves as super_admin via public API
CREATE OR REPLACE FUNCTION public.validate_profile_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent unauthorized role escalation
    IF (NEW.role != OLD.role OR OLD.role IS NULL) AND NOT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        -- Only super_admins can change roles
        NEW.role := OLD.role;
    END IF;

    -- Sanitize names
    NEW.full_name := public.sanitize_text(NEW.full_name);
    
    -- Enforce max length
    IF length(NEW.full_name) > 100 THEN
        RAISE EXCEPTION 'Full name exceeds maximum length of 100 characters.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_profile_update ON profiles;
CREATE TRIGGER trg_validate_profile_update
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.validate_profile_update();

-- 5. AUDIT LOGGING FOR SECURITY EVENTS
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    event_type TEXT NOT NULL, -- e.g., 'RATE_LIMIT_EXCEEDED', 'UNAUTHORIZED_ACCESS'
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for security logs (Only super_admins can see them)
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view security logs" ON public.security_logs;

CREATE POLICY "Super admins can view security logs"
    ON public.security_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

NOTIFY pgrst, 'reload schema';
