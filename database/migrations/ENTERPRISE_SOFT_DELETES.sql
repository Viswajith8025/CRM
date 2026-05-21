-- ==============================================================================
-- ENTERPRISE SOFT DELETES
-- Prevents hard deletion of operational history.
-- ==============================================================================

-- 1. Add deleted_at to tasks
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Update queries that pull tasks to ignore soft-deleted ones automatically
-- (Frontend already handles .is('deleted_at', null) for tasksStore.ts, 
-- but we should ensure RLS hides them if needed, or rely on frontend.)

-- 3. Add deleted_at to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 4. Add deleted_at to invoices
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 5. Add deleted_at to work_sessions
ALTER TABLE public.work_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Helper RLS policy updates to hide deleted records automatically from casual SELECT queries.
-- We do NOT add this globally because some admin dashboards MIGHT need to see deleted_at records.
-- It is usually best to handle .is('deleted_at', null) on the frontend API calls.
