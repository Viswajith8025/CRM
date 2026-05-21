-- ==============================================================================
-- ENTERPRISE TASK DEADLINE ENFORCEMENT (H-7 FIX)
-- ==============================================================================
-- This trigger enforces operational discipline by ensuring that any task marked
-- as 'done' past its deadline is automatically tagged with a penalty flag.
-- It prevents employees from silently completing late tasks without a trace.

-- 1. Ensure tasks table has an 'is_overdue_completion' boolean flag
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_overdue_completion BOOLEAN DEFAULT FALSE;

-- 2. Create the Trigger Function
CREATE OR REPLACE FUNCTION public.check_task_deadline()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check when a task is moved to the 'done' status
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        -- If the task has a due date and it is completed AFTER that date
        IF NEW.due_date IS NOT NULL AND NOW() > NEW.due_date THEN
            -- Flag the task as an overdue completion
            NEW.is_overdue_completion := TRUE;

            -- We also append an operational penalty note to the audit log if the table exists
            -- We assume the user_id is the person who made the update (using auth.uid() if possible, 
            -- or falling back to the assigned user).
            BEGIN
                INSERT INTO public.audit_logs (
                    organization_id, 
                    user_id, 
                    table_name, 
                    record_id, 
                    action, 
                    new_data
                )
                VALUES (
                    NEW.organization_id, 
                    COALESCE(auth.uid(), NEW.assigned_to), 
                    'tasks', 
                    NEW.id, 
                    'PENALTY', 
                    jsonb_build_object(
                        'event', 'OVERDUE_COMPLETION',
                        'task_title', NEW.title,
                        'due_date', NEW.due_date,
                        'completed_at', NOW()
                    )
                );
            EXCEPTION WHEN OTHERS THEN
                -- If audit_logs doesn't exist or fails, silently continue the task update
            END;
        ELSE
            -- If it was completed on time, ensure the flag is false
            NEW.is_overdue_completion := FALSE;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attach the Trigger to the tasks table
DROP TRIGGER IF EXISTS enforce_task_deadline ON public.tasks;
CREATE TRIGGER enforce_task_deadline
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.check_task_deadline();

NOTIFY pgrst, 'reload schema';
