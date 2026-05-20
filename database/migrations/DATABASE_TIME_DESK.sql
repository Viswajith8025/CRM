-- ERP Time Desk Production-Grade Architecture
-- Inspired by Desklog, Clockify, and ERPNext

-- 1. ENUMS
DO $$ BEGIN
    CREATE TYPE session_status AS ENUM ('active', 'completed', 'paused');
    CREATE TYPE break_type     AS ENUM ('lunch', 'short_break', 'personal', 'meeting');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. WORK SESSIONS (Main container for employee work day)
CREATE TABLE IF NOT EXISTS public.work_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    
    status session_status NOT NULL DEFAULT 'active',
    
    -- Metadata for intelligence
    ip_address TEXT,
    user_agent TEXT,
    location_data JSONB,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. BREAK SESSIONS (Child of work sessions)
CREATE TABLE IF NOT EXISTS public.break_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    work_session_id UUID NOT NULL REFERENCES public.work_sessions(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    
    type break_type DEFAULT 'short_break',
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. ENHANCED TIME LOGS (Link to work sessions for verification)
-- Note: We might need to update existing time_logs table if it exists
DO $$ BEGIN
    ALTER TABLE public.time_logs ADD COLUMN work_session_id UUID REFERENCES public.work_sessions(id);
EXCEPTION WHEN duplicate_column THEN null; END $$;

-- 5. DAILY TIMESHEETS (Aggregated views/tables for reporting)
CREATE TABLE IF NOT EXISTS public.timesheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    date DATE NOT NULL,
    
    total_work_minutes INTEGER DEFAULT 0,
    total_break_minutes INTEGER DEFAULT 0,
    total_task_minutes INTEGER DEFAULT 0,
    
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, date)
);

-- 6. RLS POLICIES
ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheets ENABLE ROW LEVEL SECURITY;

-- 7. FUNCTIONS & TRIGGERS FOR DURATION CALCULATIONS

-- Function to get active work session for a user
CREATE OR REPLACE FUNCTION get_active_work_session(p_user_id UUID)
RETURNS SETOF public.work_sessions AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM public.work_sessions
    WHERE user_id = p_user_id AND status = 'active'
    ORDER BY start_time DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle check-in
CREATE OR REPLACE FUNCTION handle_check_in(p_org_id UUID, p_user_id UUID, p_ip TEXT DEFAULT NULL, p_ua TEXT DEFAULT NULL)
RETURNS UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    -- Close any existing active sessions (safety net)
    UPDATE public.work_sessions 
    SET end_time = now(), status = 'completed'
    WHERE user_id = p_user_id AND status = 'active';
    
    INSERT INTO public.work_sessions (organization_id, user_id, ip_address, user_agent)
    VALUES (p_org_id, p_user_id, p_ip, p_ua)
    RETURNING id INTO v_session_id;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle check-out
CREATE OR REPLACE FUNCTION handle_check_out(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Close any active breaks
    UPDATE public.break_sessions
    SET end_time = now()
    FROM public.work_sessions
    WHERE public.break_sessions.work_session_id = public.work_sessions.id
    AND public.work_sessions.user_id = p_user_id
    AND public.break_sessions.end_time IS NULL;

    UPDATE public.work_sessions 
    SET end_time = now(), status = 'completed'
    WHERE user_id = p_user_id AND status = 'active';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. INDEXING
CREATE INDEX IF NOT EXISTS idx_work_sessions_user_status ON public.work_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_break_sessions_work_session ON public.break_sessions(work_session_id);

-- 9. ATTENDANCE & UTILIZATION VIEWS
CREATE OR REPLACE VIEW public.daily_attendance_summary AS
WITH daily_work AS (
    SELECT 
        organization_id,
        user_id,
        start_time::DATE as work_date,
        MIN(start_time) as first_check_in,
        MAX(end_time) as last_check_out,
        SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, now()) - start_time))/60)::INTEGER as total_session_minutes
    FROM public.work_sessions
    GROUP BY organization_id, user_id, start_time::DATE
),
daily_breaks AS (
    SELECT 
        organization_id,
        user_id,
        start_time::DATE as break_date,
        SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, now()) - start_time))/60)::INTEGER as total_break_minutes
    FROM public.break_sessions
    GROUP BY organization_id, user_id, start_time::DATE
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

-- 10. DAILY TASKS (For mandatory completion workflow)
CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    task_date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for Daily Tasks
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own daily tasks"
    ON public.daily_tasks
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all daily tasks"
    ON public.daily_tasks
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND organization_id = public.daily_tasks.organization_id
        )
    );

CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON public.daily_tasks(user_id, task_date);
