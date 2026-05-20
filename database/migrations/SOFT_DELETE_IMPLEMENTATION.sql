-- ==============================================================================
-- SOFT DELETE & AUDIT PRESERVATION SYSTEM
-- Implements soft delete and removes dangerous cascade deletions
-- ==============================================================================

-- 1. Add Soft Delete Columns
ALTER TABLE public.projects 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.tasks 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Heal existing records
UPDATE public.projects SET is_archived = false WHERE is_archived IS NULL;
UPDATE public.tasks SET is_archived = false WHERE is_archived IS NULL;

ALTER TABLE public.invoices 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

ALTER TABLE public.payments 
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES auth.users(id);

-- 2. Audit Foreign Keys and Remove Cascades
-- We want to prevent deleting a project if it has invoices or time logs.

-- Check existing foreign keys on invoices
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT constraint_name, table_name 
        FROM information_schema.key_column_usage 
        WHERE table_name IN ('invoices', 'payments', 'time_logs', 'tasks') 
          AND column_name = 'project_id'
    ) LOOP
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    END LOOP;
END $$;

-- Re-apply Foreign Keys with RESTRICT (Prevention)
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_project_id_fkey;
ALTER TABLE public.invoices
    ADD CONSTRAINT invoices_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES public.projects(id) 
    ON DELETE RESTRICT;

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_project_id_fkey;
ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_project_id_fkey 
    FOREIGN KEY (project_id) REFERENCES public.projects(id) 
    ON DELETE RESTRICT;

-- Ensure time logs remain even if task is soft-deleted
-- But if the record is HARD deleted (DB maintenance), we RESTRICT.
ALTER TABLE public.time_logs DROP CONSTRAINT IF EXISTS time_logs_task_id_fkey;
ALTER TABLE public.time_logs
    ADD CONSTRAINT time_logs_task_id_fkey 
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) 
    ON DELETE RESTRICT;

-- 3. Automatic Soft Delete Filter Views (Optional, but let's stick to RLS)
-- Update RLS to hide deleted items

CREATE OR REPLACE FUNCTION public.is_not_deleted(rec_deleted_at TIMESTAMPTZ)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN rec_deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. Archive Helper Function
CREATE OR REPLACE FUNCTION public.archive_project(project_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.projects 
    SET is_archived = true, 
        updated_at = NOW() 
    WHERE id = project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Hard Deletion Prevention Trigger
CREATE OR REPLACE FUNCTION public.prevent_hard_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Hard Deletion Prohibited: Use soft delete (deleted_at) to preserve financial and audit history.';
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables
DROP TRIGGER IF EXISTS tr_prevent_hard_delete_projects ON public.projects;
CREATE TRIGGER tr_prevent_hard_delete_projects
    BEFORE DELETE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS tr_prevent_hard_delete_invoices ON public.invoices;
CREATE TRIGGER tr_prevent_hard_delete_invoices
    BEFORE DELETE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

-- Refresh schema
NOTIFY pgrst, 'reload schema';
