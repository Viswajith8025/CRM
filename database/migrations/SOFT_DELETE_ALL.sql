DO $$ 
BEGIN
  -- 1. project_modules
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_modules' AND column_name='deleted_at') THEN
    ALTER TABLE project_modules ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- 2. project_sprints
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_sprints' AND column_name='deleted_at') THEN
    ALTER TABLE project_sprints ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- 3. project_milestones
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='project_milestones' AND column_name='deleted_at') THEN
    ALTER TABLE project_milestones ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- 4. task_subtasks
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_subtasks' AND column_name='deleted_at') THEN
    ALTER TABLE task_subtasks ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- 5. task_comments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='task_comments' AND column_name='deleted_at') THEN
    ALTER TABLE task_comments ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

  -- 6. clients
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='deleted_at') THEN
    ALTER TABLE clients ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;

END $$;

NOTIFY pgrst, 'reload schema';
