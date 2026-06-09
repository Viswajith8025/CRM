-- ==============================================================================
-- ENTERPRISE SOFT-DELETE ENFORCEMENT
-- Adds archived_at columns to core entities to prevent destructive hard-deletes
-- and cascading data loss on complex project/task hierarchies.
-- ==============================================================================

-- 1. Projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Modules
ALTER TABLE public.project_modules ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 3. Tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 4. Leads & Clients
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 5. Invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
