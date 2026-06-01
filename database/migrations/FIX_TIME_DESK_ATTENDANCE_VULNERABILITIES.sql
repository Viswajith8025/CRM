-- ==============================================================================
-- CRITICAL FIX: TIME DESK VULNERABILITIES & REPORTING ACCURACY
-- ==============================================================================
-- ISSUES FIXED:
-- 1. Double-Punch / Splitting Shifts on UI Lag
-- 2. Timezone UTC Drift causing shifts before 5:30 AM to log on the previous day.
-- 3. Time Theft RLS vulnerability allowing employees to edit their own start_time.
-- ==============================================================================

-- 1. FIX HANDLE_CHECK_IN (Prevent Duplicate/Zombie Shifts)
CREATE OR REPLACE FUNCTION public.handle_check_in(p_org_id UUID, p_user_id UUID, p_ip TEXT DEFAULT NULL, p_ua TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- 1. Check if an active session already exists (Anti-Spam / UI Lag Resume)
    SELECT id INTO v_session_id FROM public.work_sessions WHERE user_id = p_user_id AND status = 'active';
    
    IF v_session_id IS NOT NULL THEN
        RETURN v_session_id; -- Silently return the existing active session instead of splitting their day
    END IF;
    
    -- 2. Otherwise create new
    INSERT INTO public.work_sessions (organization_id, user_id, ip_address, user_agent)
    VALUES (p_org_id, p_user_id, p_ip, p_ua)
    RETURNING id INTO v_session_id;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. FIX TIMEZONE DRIFT IN ATTENDANCE REPORTS (IST Standardization)
DROP VIEW IF EXISTS public.daily_attendance_summary;
CREATE OR REPLACE VIEW public.daily_attendance_summary AS
WITH daily_work AS (
    SELECT 
        organization_id,
        user_id,
        (start_time AT TIME ZONE 'Asia/Kolkata')::DATE as work_date,
        MIN(start_time) as first_check_in,
        MAX(end_time) as last_check_out,
        SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, now()) - start_time))/60)::INTEGER as total_session_minutes
    FROM public.work_sessions
    GROUP BY organization_id, user_id, (start_time AT TIME ZONE 'Asia/Kolkata')::DATE
),
daily_breaks AS (
    SELECT 
        organization_id,
        user_id,
        (start_time AT TIME ZONE 'Asia/Kolkata')::DATE as break_date,
        SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, now()) - start_time))/60)::INTEGER as total_break_minutes
    FROM public.break_sessions
    GROUP BY organization_id, user_id, (start_time AT TIME ZONE 'Asia/Kolkata')::DATE
)
SELECT 
    dw.organization_id,
    dw.user_id,
    dw.work_date,
    dw.first_check_in,
    dw.last_check_out,
    dw.total_session_minutes,
    COALESCE(db.total_break_minutes, 0) as total_break_minutes,
    (dw.total_session_minutes - COALESCE(db.total_break_minutes, 0)) as net_work_minutes
FROM daily_work dw
LEFT JOIN daily_breaks db ON dw.user_id = db.user_id AND dw.work_date = db.break_date AND dw.organization_id = db.organization_id;


-- 3. FIX TIME THEFT VULNERABILITY (Database Trigger Lock)
-- Users were previously granted UPDATE access to their own rows, allowing them to freely alter their start_time.
-- We use a database trigger to enforce immutability of historical time data while preserving offline-sync capabilities.

CREATE OR REPLACE FUNCTION public.prevent_time_theft()
RETURNS TRIGGER AS $$
DECLARE
    v_is_admin BOOLEAN;
BEGIN
    -- Check if user is HR Admin
    v_is_admin := public.has_permission('hr.manage_attendance');
    
    IF NOT v_is_admin THEN
        -- If user is NOT an admin, they cannot change start_time
        IF NEW.start_time != OLD.start_time THEN
            RAISE EXCEPTION 'Security Policy: Cannot modify start_time. Time theft detected.';
        END IF;
        
        -- If they are trying to change an ALREADY SET end_time
        IF OLD.end_time IS NOT NULL AND NEW.end_time != OLD.end_time THEN
            RAISE EXCEPTION 'Security Policy: Cannot modify a completed session.';
        END IF;
        
        -- Do not allow future dating of end_time
        IF NEW.end_time > NOW() + INTERVAL '1 minute' THEN
             NEW.end_time := NOW();
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_work_time_theft ON public.work_sessions;
CREATE TRIGGER trg_prevent_work_time_theft
BEFORE UPDATE ON public.work_sessions
FOR EACH ROW EXECUTE FUNCTION public.prevent_time_theft();

DROP TRIGGER IF EXISTS trg_prevent_break_time_theft ON public.break_sessions;
CREATE TRIGGER trg_prevent_break_time_theft
BEFORE UPDATE ON public.break_sessions
FOR EACH ROW EXECUTE FUNCTION public.prevent_time_theft();

NOTIFY pgrst, 'reload schema';
