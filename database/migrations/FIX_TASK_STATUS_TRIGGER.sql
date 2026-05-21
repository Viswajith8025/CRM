-- Fix the trigger that causes 22P02 enum error when completing tasks
CREATE OR REPLACE FUNCTION public.check_task_dependencies()
RETURNS TRIGGER AS $ $
DECLARE
  unresolved_dep_title TEXT;
BEGIN
  -- We ONLY check 'done' because 'completed' is not a valid task_status enum value.
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
$ $ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema notification
NOTIFY pgrst, 'reload schema';
