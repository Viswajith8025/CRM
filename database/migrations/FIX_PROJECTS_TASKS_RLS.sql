-- ==============================================================================
-- CRITICAL FIX: RLS CIRCULAR DEPENDENCY & COLUMN ERRORS (500 / 400 ERRORS)
-- ==============================================================================
-- ISSUE: Querying projects with nested tasks caused an Infinite Recursion (500 Error)
-- because the tasks RLS policy queried projects, triggering projects RLS.
-- Additionally, the "created_by" column error (400 Error) needs to be formally dropped.
-- FIX: We use a SECURITY DEFINER helper function to bypass circular RLS triggers.
-- ==============================================================================

-- 1. Helper function: Safely get project department without triggering RLS
CREATE OR REPLACE FUNCTION public.get_project_department(p_project_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT department_id FROM public.projects WHERE id = p_project_id;
$$;

-- 2. Ensure previous broken policies are dropped
DROP POLICY IF EXISTS "Secure Policy: Select Projects" ON public.projects;
DROP POLICY IF EXISTS "Secure Policy: Update Projects" ON public.projects;
DROP POLICY IF EXISTS "Secure Policy: Select Tasks" ON public.tasks;
DROP POLICY IF EXISTS "Secure Policy: Update Tasks" ON public.tasks;

-- ==============================================================================
-- PROJECTS RLS (Department Isolation) - FIXED 'created_by' ERROR
-- ==============================================================================
CREATE POLICY "Secure Policy: Select Projects" ON public.projects
FOR SELECT USING (
    organization_id = get_my_org_id() 
    AND (
        public.has_permission('projects.manage') -- Admins/Managers see all
        OR (department_id IS NOT NULL AND public.is_member_of_dept(department_id)) -- Dept members see dept projects
        OR public.is_member_of_project(id) -- Explicit project members see their project
    )
);

CREATE POLICY "Secure Policy: Update Projects" ON public.projects
FOR UPDATE USING (
    organization_id = get_my_org_id() 
    AND (
        public.has_permission('projects.manage') 
        OR public.is_lead_of_project(id)
        OR (department_id IS NOT NULL AND public.is_lead_of_dept(department_id))
    )
) WITH CHECK (
    organization_id = get_my_org_id() 
    AND (
        public.has_permission('projects.manage') 
        OR public.is_lead_of_project(id)
        OR (department_id IS NOT NULL AND public.is_lead_of_dept(department_id))
    )
);

-- ==============================================================================
-- TASKS RLS (Assignee & Team Isolation) - FIXED CIRCULAR RLS DEPENDENCY
-- ==============================================================================
CREATE POLICY "Secure Policy: Select Tasks" ON public.tasks
FOR SELECT USING (
    organization_id = get_my_org_id() 
    AND (
        public.has_permission('projects.manage')
        OR assigned_to = auth.uid()
        OR (project_id IS NOT NULL AND public.is_member_of_project(project_id))
        -- Use SECURITY DEFINER helper to prevent infinite RLS recursion!
        OR (project_id IS NOT NULL AND public.is_member_of_dept(public.get_project_department(project_id)))
    )
);

CREATE POLICY "Secure Policy: Update Tasks" ON public.tasks
FOR UPDATE USING (
    organization_id = get_my_org_id() 
    AND (
        public.has_permission('projects.manage')
        OR assigned_to = auth.uid()
        OR (project_id IS NOT NULL AND public.is_lead_of_project(project_id))
        OR (project_id IS NOT NULL AND public.is_lead_of_dept(public.get_project_department(project_id)))
    )
) WITH CHECK (
    organization_id = get_my_org_id() 
    AND (
        public.has_permission('projects.manage')
        OR assigned_to = auth.uid()
        OR (project_id IS NOT NULL AND public.is_lead_of_project(project_id))
        OR (project_id IS NOT NULL AND public.is_lead_of_dept(public.get_project_department(project_id)))
    )
);

NOTIFY pgrst, 'reload schema';
