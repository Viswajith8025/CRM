-- ==============================================================================
-- ENTERPRISE WORKFORCE ENGINE (PHASE 1)
-- ==============================================================================
-- Redesign of the time tracking architecture to be backend-authoritative,
-- biometric-ready, and resilient against browser crashes (zombie shifts).
-- ==============================================================================

-- 1. ESSL BIOMETRIC / SOURCE READINESS
-- Adding punch_source to identify where the punch originated (web, hardware, auto_closed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'punch_source_type') THEN
        CREATE TYPE punch_source_type AS ENUM ('web', 'mobile_app', 'biometric_device', 'auto_closed', 'manual_override');
    END IF;
END$$;

ALTER TABLE public.work_sessions 
ADD COLUMN IF NOT EXISTS punch_source punch_source_type DEFAULT 'web',
ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. ACTIVE SESSION VALIDATION (PREVENT OVERLAPPING SHIFTS)
-- Ensures an employee can only have ONE active work session at any given time.
-- This physically blocks double-punching via UI lag or API spam.
DROP INDEX IF EXISTS idx_one_active_session_per_user;
CREATE UNIQUE INDEX idx_one_active_session_per_user 
ON public.work_sessions (user_id) 
WHERE status = 'active';

-- 3. HEARTBEAT RPC
-- Called silently by the frontend every 5 minutes to prove the browser tab is alive.
CREATE OR REPLACE FUNCTION public.handle_session_heartbeat(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.work_sessions
  SET last_heartbeat_at = NOW()
  WHERE user_id = p_user_id AND status = 'active';
END;
$$;

-- 4. ZOMBIE SWEEPER RPC (STALE SESSION RECOVERY)
-- This function is designed to be called by pg_cron or an Edge Function every 15 mins.
-- It forcefully closes sessions that have not received a heartbeat in over 30 minutes.
CREATE OR REPLACE FUNCTION public.resolve_zombie_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_closed_count integer := 0;
BEGIN
  -- Close breaks first (for any active work session we are about to close)
  UPDATE public.break_sessions bs
  SET end_time = ws.last_heartbeat_at + INTERVAL '5 minutes'
  FROM public.work_sessions ws
  WHERE bs.work_session_id = ws.id
    AND bs.end_time IS NULL
    AND ws.status = 'active'
    AND ws.last_heartbeat_at < (NOW() - INTERVAL '30 minutes');

  -- Close the zombie work sessions
  WITH closed AS (
    UPDATE public.work_sessions
    SET 
      status = 'completed',
      end_time = last_heartbeat_at + INTERVAL '5 minutes',
      punch_source = 'auto_closed'
    WHERE status = 'active'
      AND last_heartbeat_at < (NOW() - INTERVAL '30 minutes')
    RETURNING id
  )
  SELECT count(*) INTO v_closed_count FROM closed;

  RETURN v_closed_count;
END;
$$;
