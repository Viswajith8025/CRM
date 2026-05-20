-- ==============================================================================
-- CRITICAL RECOVERY: Restore simple org-based RLS + heal all data
-- Run this entire script in Supabase SQL Editor
-- ==============================================================================

-- STEP 1: Drop the broken permission-based policies that replaced your org policies
DROP POLICY IF EXISTS "Projects View Permission" ON public.projects;
DROP POLICY IF EXISTS "Tasks View Permission" ON public.tasks;
DROP POLICY IF EXISTS "Leads View Permission" ON public.leads;
DROP POLICY IF EXISTS "Invoices View Permission" ON public.invoices;

-- STEP 2: Restore simple, working org-scoped RLS policies

-- PROJECTS
DROP POLICY IF EXISTS "Orgs can view their own projects" ON public.projects;
CREATE POLICY "Orgs can view their own projects"
    ON public.projects FOR SELECT
    USING (organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Orgs can insert their own projects" ON public.projects;
CREATE POLICY "Orgs can insert their own projects"
    ON public.projects FOR INSERT
    WITH CHECK (organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Orgs can update their own projects" ON public.projects;
CREATE POLICY "Orgs can update their own projects"
    ON public.projects FOR UPDATE
    USING (organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

-- TASKS
DROP POLICY IF EXISTS "Orgs can view their own tasks" ON public.tasks;
CREATE POLICY "Orgs can view their own tasks"
    ON public.tasks FOR SELECT
    USING (organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Orgs can insert their own tasks" ON public.tasks;
CREATE POLICY "Orgs can insert their own tasks"
    ON public.tasks FOR INSERT
    WITH CHECK (organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

DROP POLICY IF EXISTS "Orgs can update their own tasks" ON public.tasks;
CREATE POLICY "Orgs can update their own tasks"
    ON public.tasks FOR UPDATE
    USING (organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

-- LEADS
DROP POLICY IF EXISTS "Orgs can view their own leads" ON public.leads;
CREATE POLICY "Orgs can view their own leads"
    ON public.leads FOR SELECT
    USING (organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

-- INVOICES
DROP POLICY IF EXISTS "Orgs can view their own invoices" ON public.invoices;
CREATE POLICY "Orgs can view their own invoices"
    ON public.invoices FOR SELECT
    USING (organization_id = (
        SELECT organization_id FROM public.profiles WHERE id = auth.uid()
    ));

-- STEP 3: Heal all data - reset archive/delete flags on existing records
UPDATE public.projects 
SET is_archived = false 
WHERE is_archived IS NULL OR is_archived = true;

UPDATE public.projects 
SET deleted_at = NULL 
WHERE deleted_at IS NOT NULL;

UPDATE public.tasks 
SET is_archived = false 
WHERE is_archived IS NULL;

UPDATE public.tasks 
SET deleted_at = NULL 
WHERE deleted_at IS NOT NULL;

-- STEP 4: Verify - this should return your projects
SELECT id, name, organization_id, is_archived, deleted_at 
FROM public.projects 
ORDER BY created_at DESC 
LIMIT 20;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
