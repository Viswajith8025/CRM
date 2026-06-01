-- ==============================================================================
-- CRITICAL FIX: TASK DEPENDENCY ENFORCEMENT
-- ==============================================================================
-- ISSUE: Kanban drag-and-drop and optimistic UI updates were bypassing the 
-- client-side dependency checks, allowing users to mark tasks as 'done' 
-- even if their dependent tasks were still incomplete.
-- FIX: Create a database-level BEFORE UPDATE trigger to strictly enforce 
-- dependencies for the 'done' status.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_task_dependencies_on_complete()
RETURNS TRIGGER AS $$
DECLARE
    v_incomplete_parent_title TEXT;
BEGIN
    -- Only enforce if status is changing to 'done'
    IF NEW.status = 'done' AND OLD.status != 'done' THEN
        -- Check if any parent task is NOT done
        SELECT t.title INTO v_incomplete_parent_title
        FROM public.task_dependencies td
        JOIN public.tasks t ON td.depends_on_task_id = t.id
        WHERE td.task_id = NEW.id
          AND t.status != 'done'
        LIMIT 1;

        IF v_incomplete_parent_title IS NOT NULL THEN
            RAISE EXCEPTION 'Dependency Violation: Cannot complete this task. It is blocked by incomplete task "%"', v_incomplete_parent_title;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_task_dependencies ON public.tasks;
CREATE TRIGGER trg_enforce_task_dependencies
BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.check_task_dependencies_on_complete();

NOTIFY pgrst, 'reload schema';
