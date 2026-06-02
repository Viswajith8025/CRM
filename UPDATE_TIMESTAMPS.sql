-- TIMEDESK SECURITY UPDATE: ENFORCING SERVER-SIDE TIMESTAMPS

-- 1. Create a secure RPC for ending breaks using the server's clock (now())
CREATE OR REPLACE FUNCTION handle_end_break(p_break_id UUID) 
RETURNS void AS $$
BEGIN
    UPDATE break_sessions
    SET end_time = now()
    WHERE id = p_break_id AND end_time IS NULL;
END;
$$ LANGUAGE plpgsql;


-- 2. Migration Plan & Backward-Compatibility Adjustments
-- Problem: Previous offline queues or manipulated client clocks may have resulted in timestamps in the future,
-- or breaks that appear to have negative durations if start_time was server-side and end_time was a spoofed past client-time.

-- Fix A: Cap any end_time that is somehow in the future to now()
UPDATE work_sessions 
SET end_time = now() 
WHERE end_time > now();

UPDATE break_sessions 
SET end_time = now() 
WHERE end_time > now();

-- Fix B: Ensure no break_session has an end_time earlier than its start_time (negative break duration fraud)
-- We will set the end_time to start_time + 5 minutes as a penalty/fallback if this fraud is detected.
UPDATE break_sessions
SET end_time = start_time + interval '5 minutes'
WHERE end_time < start_time;

-- Fix C: Ensure no work_session has an end_time earlier than start_time
UPDATE work_sessions
SET end_time = start_time + interval '1 hour'
WHERE end_time < start_time;
