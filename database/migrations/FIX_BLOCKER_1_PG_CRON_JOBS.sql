-- ==============================================================================
-- FIX BLOCKER-1: BACKGROUND AUTOMATION (PG_CRON)
-- ==============================================================================
-- This script enables the pg_cron extension and sets up automated background jobs.
-- It fixes the issue of employees forgetting to clock out and overdue task tracking.

-- 1. Enable pg_cron (Requires Superuser / Database Owner permissions)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Create the Auto-Clock-Out Function
-- This finds any "active" work session that has been running for more than 14 hours
-- and forcefully closes it, preventing payroll inflation.
CREATE OR REPLACE FUNCTION public.job_auto_clock_out_forgotten_shifts()
RETURNS void AS $$
DECLARE
    v_session RECORD;
BEGIN
    FOR v_session IN 
        SELECT id, user_id 
        FROM public.work_sessions 
        WHERE status = 'active' 
        AND start_time < NOW() - INTERVAL '14 hours'
    LOOP
        -- End the session
        UPDATE public.work_sessions
        SET 
            status = 'completed',
            end_time = NOW()
        WHERE id = v_session.id;

        -- End any dangling breaks
        UPDATE public.break_sessions
        SET end_time = NOW()
        WHERE work_session_id = v_session.id AND end_time IS NULL;

        -- Create an audit notification so the manager knows it was an auto-clock-out
        INSERT INTO public.notifications (organization_id, user_id, title, message, type)
        SELECT 
            organization_id, 
            v_session.user_id, 
            'Shift Auto-Closed', 
            'Your shift was automatically closed because it exceeded 14 hours.',
            'alert'
        FROM public.work_sessions 
        WHERE id = v_session.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create the Overdue Task Auto-Escalation Function
CREATE OR REPLACE FUNCTION public.job_escalate_overdue_tasks()
RETURNS void AS $$
BEGIN
    -- If a task is overdue by more than 24 hours, change status to 'escalated' (or just notify)
    -- We will insert a high-priority notification for the assignee and the lead.
    INSERT INTO public.notifications (organization_id, user_id, title, message, type)
    SELECT 
        t.organization_id, 
        t.assigned_to, 
        'Task Overdue Escalation', 
        'Task "' || t.title || '" is overdue. Please provide an update immediately.',
        'alert'
    FROM public.tasks t
    WHERE t.status NOT IN ('done', 'cancelled')
    AND t.due_date < CURRENT_DATE - INTERVAL '1 day'
    AND NOT EXISTS (
        -- Don't spam them every day for the same task
        SELECT 1 FROM public.notifications n 
        WHERE n.user_id = t.assigned_to 
        AND n.title = 'Task Overdue Escalation' 
        AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Schedule the Jobs
-- Note: cron.schedule syntax: min hour dom month dow
-- Run the auto-clock-out check every hour
SELECT cron.schedule('hourly-auto-clock-out', '0 * * * *', 'SELECT public.job_auto_clock_out_forgotten_shifts()');

-- Run the task escalation every day at 8:00 AM
SELECT cron.schedule('daily-task-escalation', '0 8 * * *', 'SELECT public.job_escalate_overdue_tasks()');

-- Refresh Cache
NOTIFY pgrst, 'reload schema';
