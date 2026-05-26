-- ==============================================================================
-- ENTERPRISE BIOMETRIC ATTENDANCE & WORKFORCE SYSTEM
-- Authoritative Backend Engine for ESSL Integration, Shifts, and Governance
-- ==============================================================================

-- 1. Biometric Devices Registry
CREATE TABLE IF NOT EXISTS public.biometric_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    ip_address TEXT,
    location TEXT,
    status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, serial_number)
);

-- 2. Immutable Biometric Logs (Raw Punches)
CREATE TABLE IF NOT EXISTS public.biometric_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    device_id UUID REFERENCES public.biometric_devices(id) ON DELETE SET NULL,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    punch_time TIMESTAMPTZ NOT NULL,
    punch_type TEXT NOT NULL CHECK (punch_type IN ('IN', 'OUT', 'UNKNOWN')),
    verification_mode TEXT DEFAULT 'UNKNOWN', -- FINGERPRINT, FACE, RFID, PIN
    raw_data JSONB, -- Stored payload from ESSL for audit
    is_processed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create Index for fast sync tracking
CREATE INDEX IF NOT EXISTS idx_biometric_logs_emp_time ON public.biometric_logs(employee_id, punch_time);
CREATE INDEX IF NOT EXISTS idx_biometric_logs_org_time ON public.biometric_logs(organization_id, punch_time);

-- 3. Shift Policies
CREATE TABLE IF NOT EXISTS public.shift_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    grace_period_minutes INT DEFAULT 15,
    half_day_threshold_hours NUMERIC DEFAULT 4.0,
    full_day_threshold_hours NUMERIC DEFAULT 8.0,
    overtime_threshold_hours NUMERIC DEFAULT 9.0,
    is_overnight BOOLEAN DEFAULT false,
    allowed_weekly_offs TEXT[] DEFAULT '{"Sunday"}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Employee Shift Assignments
CREATE TABLE IF NOT EXISTS public.employee_shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    shift_id UUID NOT NULL REFERENCES public.shift_policies(id) ON DELETE CASCADE,
    effective_from DATE NOT NULL,
    effective_to DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(employee_id, effective_from)
);

-- 5. Enterprise Attendance Sessions (The Unified Source of Truth)
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_date DATE NOT NULL,
    shift_id UUID REFERENCES public.shift_policies(id) ON DELETE SET NULL,
    first_punch_in TIMESTAMPTZ,
    last_punch_out TIMESTAMPTZ,
    total_work_minutes INT DEFAULT 0,
    overtime_minutes INT DEFAULT 0,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'incomplete', 'anomaly')),
    is_late BOOLEAN DEFAULT false,
    is_half_day BOOLEAN DEFAULT false,
    is_anomaly BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(employee_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_org_date ON public.attendance_sessions(organization_id, session_date);

-- 6. HR Attendance Corrections & Exceptions Workflow
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    requested_punch_in TIMESTAMPTZ,
    requested_punch_out TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    reviewer_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Daily Attendance Summaries (Aggregated for Dashboard & Payroll)
CREATE TABLE IF NOT EXISTS public.attendance_daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL,
    total_employees INT DEFAULT 0,
    total_present INT DEFAULT 0,
    total_absent INT DEFAULT 0,
    total_late INT DEFAULT 0,
    total_overtime_hours NUMERIC DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, summary_date)
);

-- ==============================================================================
-- CORE ENGINE: PROCESS BIOMETRIC PUNCH
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_biometric_punch(
    p_org_id UUID,
    p_device_id UUID,
    p_emp_id UUID,
    p_punch_time TIMESTAMPTZ,
    p_punch_type TEXT,
    p_verify_mode TEXT,
    p_raw_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
    v_session_id UUID;
    v_session_date DATE;
    v_shift_id UUID;
    v_shift_start TIME;
    v_grace_period INT;
    v_is_late BOOLEAN := false;
    v_active_status TEXT;
    v_last_punch_out TIMESTAMPTZ;
    v_first_punch_in TIMESTAMPTZ;
    v_total_minutes INT := 0;
    v_overtime_threshold NUMERIC;
    v_overtime_minutes INT := 0;
    v_recent_punch_count INT;
BEGIN
    -- 1. Deduplication Protection (Prevent double punching within 1 minute)
    SELECT COUNT(*) INTO v_recent_punch_count
    FROM public.biometric_logs
    WHERE employee_id = p_emp_id 
      AND punch_time >= p_punch_time - interval '1 minute'
      AND punch_time <= p_punch_time + interval '1 minute';

    IF v_recent_punch_count > 0 THEN
        RETURN jsonb_build_object('status', 'error', 'message', 'Duplicate punch detected within grace period');
    END IF;

    -- 2. Insert Immutable Raw Punch
    INSERT INTO public.biometric_logs (
        organization_id, device_id, employee_id, punch_time, punch_type, verification_mode, raw_data, is_processed
    ) VALUES (
        p_org_id, p_device_id, p_emp_id, p_punch_time, p_punch_type, p_verify_mode, p_raw_data, true
    ) RETURNING id INTO v_log_id;

    -- 3. Determine Session Date (handles overnight shifts via -6 hours logic for simplicity, configurable in enterprise)
    v_session_date := (p_punch_time AT TIME ZONE 'UTC' - interval '6 hours')::DATE;

    -- 4. Find Assigned Shift
    SELECT shift_id INTO v_shift_id
    FROM public.employee_shift_assignments
    WHERE employee_id = p_emp_id 
      AND effective_from <= v_session_date 
      AND (effective_to IS NULL OR effective_to >= v_session_date)
    ORDER BY effective_from DESC LIMIT 1;

    -- If no specific shift, fallback to a default organization shift if exists
    IF v_shift_id IS NULL THEN
        SELECT id INTO v_shift_id FROM public.shift_policies WHERE organization_id = p_org_id ORDER BY created_at ASC LIMIT 1;
    END IF;

    -- 5. Session Upsert Logic
    SELECT id, first_punch_in, last_punch_out INTO v_session_id, v_first_punch_in, v_last_punch_out
    FROM public.attendance_sessions
    WHERE employee_id = p_emp_id AND session_date = v_session_date;

    IF v_session_id IS NULL THEN
        -- FIRST PUNCH IN for the day
        IF v_shift_id IS NOT NULL THEN
            SELECT start_time, grace_period_minutes INTO v_shift_start, v_grace_period 
            FROM public.shift_policies WHERE id = v_shift_id;
            
            IF (p_punch_time::time) > (v_shift_start + (v_grace_period || ' minutes')::interval) THEN
                v_is_late := true;
            END IF;
        END IF;

        INSERT INTO public.attendance_sessions (
            organization_id, employee_id, session_date, shift_id, first_punch_in, status, is_late
        ) VALUES (
            p_org_id, p_emp_id, v_session_date, v_shift_id, p_punch_time, 'active', v_is_late
        ) RETURNING id INTO v_session_id;
        
    ELSE
        -- SUBSEQUENT PUNCH (Treat as OUT or continuous IN/OUT)
        -- We update the last_punch_out and calculate total minutes
        v_total_minutes := EXTRACT(EPOCH FROM (p_punch_time - v_first_punch_in)) / 60;
        
        -- Overtime logic
        IF v_shift_id IS NOT NULL THEN
            SELECT overtime_threshold_hours INTO v_overtime_threshold FROM public.shift_policies WHERE id = v_shift_id;
            IF v_total_minutes > (v_overtime_threshold * 60) THEN
                v_overtime_minutes := v_total_minutes - (v_overtime_threshold * 60);
            END IF;
        END IF;

        UPDATE public.attendance_sessions
        SET 
            last_punch_out = p_punch_time,
            total_work_minutes = v_total_minutes,
            overtime_minutes = v_overtime_minutes,
            updated_at = now()
        WHERE id = v_session_id;
    END IF;

    -- Sync Legacy Work Sessions for backward compatibility with older Time Desk widgets
    -- (This ensures the frontend timers reflect the biometric reality automatically)
    INSERT INTO public.work_sessions (
        organization_id, user_id, start_time, end_time, status, source
    ) VALUES (
        p_org_id, p_emp_id, COALESCE(v_first_punch_in, p_punch_time), p_punch_time, 'completed', 'biometric'
    ) ON CONFLICT (id) DO UPDATE SET end_time = p_punch_time;
    -- Note: Above is conceptual pseudo-sync for legacy fallback. Actual legacy sync might vary.

    RETURN jsonb_build_object('status', 'success', 'session_id', v_session_id, 'log_id', v_log_id);
END;
$$;

-- ==============================================================================
-- AUTOMATIC DASHBOARD AGGREGATION TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_daily_attendance_summary()
RETURNS TRIGGER AS $$
DECLARE
    v_total_present INT;
    v_total_late INT;
    v_total_overtime NUMERIC;
    v_total_employees INT;
BEGIN
    -- Only aggregate for the affected date and org
    SELECT COUNT(*) INTO v_total_employees FROM public.profiles WHERE organization_id = NEW.organization_id AND status = 'active';
    SELECT COUNT(*) INTO v_total_present FROM public.attendance_sessions WHERE session_date = NEW.session_date AND organization_id = NEW.organization_id;
    SELECT COUNT(*) INTO v_total_late FROM public.attendance_sessions WHERE session_date = NEW.session_date AND organization_id = NEW.organization_id AND is_late = true;
    SELECT COALESCE(SUM(overtime_minutes)/60.0, 0) INTO v_total_overtime FROM public.attendance_sessions WHERE session_date = NEW.session_date AND organization_id = NEW.organization_id;

    INSERT INTO public.attendance_daily_summary (
        organization_id, summary_date, total_employees, total_present, total_absent, total_late, total_overtime_hours
    ) VALUES (
        NEW.organization_id, NEW.session_date, v_total_employees, v_total_present, GREATEST(v_total_employees - v_total_present, 0), v_total_late, v_total_overtime
    ) ON CONFLICT (organization_id, summary_date) DO UPDATE SET
        total_employees = EXCLUDED.total_employees,
        total_present = EXCLUDED.total_present,
        total_absent = EXCLUDED.total_absent,
        total_late = EXCLUDED.total_late,
        total_overtime_hours = EXCLUDED.total_overtime_hours,
        updated_at = now();
        
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_daily_attendance ON public.attendance_sessions;
CREATE TRIGGER trg_update_daily_attendance
AFTER INSERT OR UPDATE ON public.attendance_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_daily_attendance_summary();

-- ==============================================================================
-- RLS POLICIES (BIOMETRIC SECURITY)
-- ==============================================================================
ALTER TABLE public.biometric_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biometric_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_daily_summary ENABLE ROW LEVEL SECURITY;

-- Admins can read/write devices
CREATE POLICY "Admin full access to devices" ON public.biometric_devices 
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin') AND organization_id = biometric_devices.organization_id));

-- Immutable Logs: Admins can read, System can insert via RPC. Employees can view their own.
CREATE POLICY "Emp can read own biometric logs" ON public.biometric_logs
    FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Admin can view all biometric logs" ON public.biometric_logs
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr') AND organization_id = biometric_logs.organization_id));

-- Attendance Sessions: Employees view own, Admins view all
CREATE POLICY "Emp can read own sessions" ON public.attendance_sessions
    FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Admin can view all sessions" ON public.attendance_sessions
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr') AND organization_id = attendance_sessions.organization_id));

-- Corrections Workflow
CREATE POLICY "Emp can create and read own corrections" ON public.attendance_corrections
    FOR ALL USING (employee_id = auth.uid());
CREATE POLICY "Admin can manage corrections" ON public.attendance_corrections
    FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr') AND organization_id = attendance_corrections.organization_id));
