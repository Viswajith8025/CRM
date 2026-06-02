-- PUBLIC FORM SECURITY SETUP (Rate Limiting & Audit Logs)

-- 1. Create a table to track IP rate limits
CREATE TABLE IF NOT EXISTS public_api_rate_limits (
    ip_address TEXT PRIMARY KEY,
    request_count INT DEFAULT 1,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create a security audit log for blocked attempts
CREATE TABLE IF NOT EXISTS security_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL, -- e.g., 'RATE_LIMIT_EXCEEDED', 'TURNSTILE_FAILED'
    ip_address TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create a function to check and update rate limits atomically
-- This allows 5 submissions per IP per hour.
CREATE OR REPLACE FUNCTION check_rate_limit(p_ip_address TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_count INT;
    v_window_start TIMESTAMP WITH TIME ZONE;
    v_limit INT := 5; -- Max submissions
    v_window INTERVAL := interval '1 hour';
BEGIN
    SELECT request_count, window_start INTO v_count, v_window_start
    FROM public_api_rate_limits
    WHERE ip_address = p_ip_address;

    IF NOT FOUND THEN
        -- First request from this IP
        INSERT INTO public_api_rate_limits (ip_address, request_count, window_start)
        VALUES (p_ip_address, 1, now());
        RETURN TRUE;
    END IF;

    IF now() > (v_window_start + v_window) THEN
        -- Window expired, reset count
        UPDATE public_api_rate_limits
        SET request_count = 1, window_start = now()
        WHERE ip_address = p_ip_address;
        RETURN TRUE;
    END IF;

    IF v_count >= v_limit THEN
        -- Rate limit exceeded
        RETURN FALSE;
    END IF;

    -- Increment count
    UPDATE public_api_rate_limits
    SET request_count = request_count + 1
    WHERE ip_address = p_ip_address;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Clean up old rate limits daily to prevent table bloat
-- Requires pg_cron extension
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        PERFORM cron.schedule(
            'cleanup_rate_limits',
            '0 0 * * *', -- Midnight UTC
            $$DELETE FROM public_api_rate_limits WHERE window_start < now() - interval '24 hours';$$
        );
    END IF;
END $$;
