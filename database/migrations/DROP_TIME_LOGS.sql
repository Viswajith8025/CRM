BEGIN;

-- Drop foreign keys if they exist pointing to time_logs
ALTER TABLE IF EXISTS public.time_logs DROP CONSTRAINT IF EXISTS time_logs_task_id_fkey;
ALTER TABLE IF EXISTS public.time_logs DROP CONSTRAINT IF EXISTS time_logs_user_id_fkey;
ALTER TABLE IF EXISTS public.time_logs DROP CONSTRAINT IF EXISTS fk_timelogs_dept;

-- Drop the table entirely
DROP TABLE IF EXISTS public.time_logs CASCADE;

-- If there is a task_time_logs table, drop it too since we don't need task timers
DROP TABLE IF EXISTS public.task_time_logs CASCADE;

COMMIT;
