-- Enterprise Background Jobs Setup (pg_cron)
-- This script configures native PostgreSQL cron jobs for automated CRM/ERP operations.

-- Ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- WARNING: If the above command fails with a permission error, you MUST enable the `pg_cron` extension in your Supabase dashboard manually!
-- Dashboard -> Database -> Extensions -> Search "pg_cron" -> Enable.

-- =======================================================================================
-- 1. AUTOMATED EMPLOYEE CLOCK-OUT
-- =======================================================================================
CREATE OR REPLACE FUNCTION auto_clock_out_employees() 
RETURNS void AS $$
DECLARE
    auto_closed_count INTEGER;
BEGIN
    -- Update work_sessions where end_time is null and start_time was before today
    WITH updated AS (
        UPDATE work_sessions
        SET 
            end_time = (start_time + interval '8 hours'), -- Cap at 8 hours
            notes = CONCAT(COALESCE(notes, ''), ' [System: Auto-clocked out at midnight]')
        WHERE end_time IS NULL 
        AND date_trunc('day', start_time) < date_trunc('day', now())
        RETURNING id
    )
    SELECT count(*) INTO auto_closed_count FROM updated;
    
    RAISE NOTICE 'Auto-clocked out % employees.', auto_closed_count;
END;
$$ LANGUAGE plpgsql;

-- Schedule: Runs every day at 23:59 UTC
-- NOTE: Adjust the cron expression timezone if your company operates on a specific local time.
SELECT cron.schedule(
    'auto_clock_out_job',
    '59 23 * * *', 
    'SELECT auto_clock_out_employees();'
);


-- =======================================================================================
-- 2. AUTOMATED TASK ESCALATION
-- =======================================================================================
CREATE OR REPLACE FUNCTION escalate_overdue_tasks() 
RETURNS void AS $$
BEGIN
    UPDATE tasks
    SET 
        status = 'escalated',
        updated_at = now()
    WHERE 
        status NOT IN ('completed', 'cancelled', 'escalated') 
        AND due_date < now();
END;
$$ LANGUAGE plpgsql;

-- Schedule: Runs at the top of every hour (Minute 0)
SELECT cron.schedule(
    'escalate_tasks_job',
    '0 * * * *', 
    'SELECT escalate_overdue_tasks();'
);


-- =======================================================================================
-- 3. RECURRING INVOICES GENERATOR
-- =======================================================================================
CREATE OR REPLACE FUNCTION process_recurring_invoices() 
RETURNS void AS $$
BEGIN
    -- 1. Insert new invoices for active subscriptions that are due for billing
    -- Assuming your schema has a `subscriptions` table. If not, adapt to your recurring model.
    -- This checks if next_billing_date is today or in the past.
    INSERT INTO invoices (client_id, amount, status, due_date, created_at, updated_at)
    SELECT 
        client_id, 
        amount, 
        'unpaid', 
        now() + interval '14 days', -- Net 14 terms
        now(),
        now()
    FROM subscriptions
    WHERE next_billing_date <= now() AND status = 'active';

    -- 2. Push the next_billing_date forward by 1 month for processed subscriptions
    UPDATE subscriptions
    SET next_billing_date = next_billing_date + interval '1 month'
    WHERE next_billing_date <= now() AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Schedule: Runs daily at 01:00 AM UTC
SELECT cron.schedule(
    'recurring_invoices_job',
    '0 1 * * *', 
    'SELECT process_recurring_invoices();'
);


-- =======================================================================================
-- HELPER COMMANDS FOR MONITORING
-- =======================================================================================
-- To check active cron jobs:
-- SELECT * FROM cron.job;

-- To unschedule a cron job:
-- SELECT cron.unschedule('auto_clock_out_job');

-- To view execution history and failures:
-- SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
