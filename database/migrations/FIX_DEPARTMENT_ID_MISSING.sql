-- ==============================================================================
-- FIX MISSING DEPARTMENT ID COLUMNS
-- ==============================================================================
-- Resolves the "column department_id does not exist" error that occurs during
-- task insertion due to the snapshot_department_id trigger.

-- Ensure the columns exist on the affected tables.
-- We use a DO block to safely add the columns and attempt to add foreign keys 
-- only if the departments table exists.

DO $$ 
BEGIN
    -- Add to profiles
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'department_id') THEN
        ALTER TABLE public.profiles ADD COLUMN department_id UUID;
    END IF;

    -- Add to tasks
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'department_id') THEN
        ALTER TABLE public.tasks ADD COLUMN department_id UUID;
    END IF;

    -- Add to time_logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'time_logs' AND column_name = 'department_id') THEN
        ALTER TABLE public.time_logs ADD COLUMN department_id UUID;
    END IF;

    -- Attempt to add foreign keys if departments table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'departments') THEN
        BEGIN
            ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_dept FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN null; END;

        BEGIN
            ALTER TABLE public.tasks ADD CONSTRAINT fk_tasks_dept FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN null; END;

        BEGIN
            ALTER TABLE public.time_logs ADD CONSTRAINT fk_timelogs_dept FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_object THEN null; END;
    END IF;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
