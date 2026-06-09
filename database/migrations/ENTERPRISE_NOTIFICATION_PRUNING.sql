-- Enable the pg_cron extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create the pruning function
CREATE OR REPLACE FUNCTION prune_old_notifications()
RETURNS void AS $$
BEGIN
    -- Soft-delete or hard-delete notifications older than 90 days
    -- Assuming table name is notifications and has created_at column
    DELETE FROM public.notifications
    WHERE created_at < NOW() - INTERVAL '90 days';

    -- Also prune old audit logs or leave request actions if needed
    -- For now, focusing on notifications as requested.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Schedule the job to run every day at midnight (UTC)
-- We check if the job already exists and unschedule it first to avoid duplicates
DO $$
BEGIN
    PERFORM cron.unschedule('prune_old_notifications_job');
EXCEPTION WHEN OTHERS THEN
    -- Ignore error if job doesn't exist
END;
$$;

SELECT cron.schedule(
    'prune_old_notifications_job', 
    '0 0 * * *', 
    'SELECT prune_old_notifications()'
);
