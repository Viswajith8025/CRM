-- Fix the database trigger that was throwing the 22P02 error ("completed" invalid enum)
CREATE OR REPLACE FUNCTION public.enforce_task_dependencies()
RETURNS TRIGGER AS $$
DECLARE
  v_unresolved_count INTEGER;
  v_unresolved_title TEXT;
BEGIN
  -- Only run when status is being changed TO 'done'
  IF NEW.status = 'done' AND OLD.status IS DISTINCT FROM 'done' THEN
    
    SELECT COUNT(*), MIN(t.title)
    INTO v_unresolved_count, v_unresolved_title
    FROM public.task_dependencies td
    JOIN public.tasks t ON t.id = td.depends_on_task_id
    WHERE td.task_id = NEW.id
      -- REMOVED 'completed' from the IN clause to prevent the enum cast error
      AND t.status NOT IN ('done');

    IF v_unresolved_count > 0 THEN
      RAISE EXCEPTION 'DEPENDENCY_ERROR: Cannot mark task as done. It is blocked by: "%". Resolve all dependencies first.',
        v_unresolved_title;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Also update check_task_dependencies if it exists
CREATE OR REPLACE FUNCTION public.check_task_dependencies()
RETURNS TRIGGER AS $$
DECLARE
  unresolved_dep_title TEXT;
BEGIN
  IF (NEW.status = 'done') AND (OLD.status IS NULL OR OLD.status <> NEW.status) THEN
    SELECT t.title INTO unresolved_dep_title
    FROM public.task_dependencies td
    JOIN public.tasks t ON t.id = td.depends_on_task_id
    WHERE td.task_id = NEW.id
      AND t.status <> 'done'
    LIMIT 1;

    IF unresolved_dep_title IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot complete task. It depends on unresolved task: %', unresolved_dep_title;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
