-- ==============================================================================
-- SERVER-SIDE OVERDUE ENGINE (PHASE 1)
-- ==============================================================================
-- This migration creates the RPC required to physically update task statuses
-- to 'overdue' when they breach their deadlines. This should be run nightly
-- via pg_cron.
-- ==============================================================================

-- 1. ENSURE ENUM HAS 'overdue' STATUS
-- We must safely add 'overdue' to the task_status enum if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumtypid = 'task_status'::regtype 
        AND enumlabel = 'overdue'
    ) THEN
        ALTER TYPE task_status ADD VALUE 'overdue';
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. CREATE THE MIDNIGHT SWEEPER RPC
-- This RPC scans for any incomplete task whose end_date has passed
-- and physically mutates its status to 'overdue'.
CREATE OR REPLACE FUNCTION public.refresh_task_overdue_states()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count integer := 0;
BEGIN
    WITH updated_tasks AS (
        UPDATE public.tasks
        SET 
            status = 'overdue',
            updated_at = NOW()
        WHERE status NOT IN ('done', 'overdue')
          AND due_date < CURRENT_DATE
        RETURNING id
    )
    SELECT count(*) INTO v_updated_count FROM updated_tasks;

    RETURN v_updated_count;
END;
$$;

-- Note: To fully automate this in Supabase, execute this in the SQL editor:
-- SELECT cron.schedule('nightly-overdue-sweeper', '1 0 * * *', 'SELECT public.refresh_task_overdue_states()');
