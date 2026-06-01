-- ==============================================================================
-- CRITICAL FIX: RLS CIRCULAR DEPENDENCY & DROP ALL PREVIOUS POLICIES
-- ==============================================================================
-- ISSUE: Querying projects with nested tasks caused an Infinite Recursion (500 Error).
-- Also, some old policies may reference 'created_by' which causes a 400 error.
-- FIX: We forcefully drop ALL policies on projects and tasks, then recreate them safely.
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

-- 2. Force drop ALL existing policies on projects and tasks to clear any 'created_by' references
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename IN ('projects', 'tasks')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END
$$;

-- ==============================================================================
-- PROJECTS RLS (Department Isolation)
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

CREATE POLICY "Secure Policy: Insert Projects" ON public.projects
FOR INSERT WITH CHECK (
    organization_id = get_my_org_id() 
    AND public.has_permission('projects.manage')
);

CREATE POLICY "Secure Policy: Update Projects" ON public.projects
FOR UPDATE USING (
    organization_id = get_my_org_id() 
    AND (
        public.has_permission('projects.manage') 
        OR public.is_lead_of_project(id)
        OR (department_id IS NOT NULL AND public.is_lead_of_dept(department_id))
    )
);

CREATE POLICY "Secure Policy: Delete Projects" ON public.projects
FOR DELETE USING (
    organization_id = get_my_org_id() 
    AND public.has_permission('projects.manage')
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

CREATE POLICY "Secure Policy: Insert Tasks" ON public.tasks
FOR INSERT WITH CHECK (
    organization_id = get_my_org_id() 
    AND (
        public.has_permission('projects.manage')
        OR (project_id IS NOT NULL AND public.is_lead_of_project(project_id))
        OR (project_id IS NOT NULL AND public.is_lead_of_dept(public.get_project_department(project_id)))
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
);

CREATE POLICY "Secure Policy: Delete Tasks" ON public.tasks
FOR DELETE USING (
    organization_id = get_my_org_id() 
    AND (
        public.has_permission('projects.manage')
        OR (project_id IS NOT NULL AND public.is_lead_of_project(project_id))
        OR (project_id IS NOT NULL AND public.is_lead_of_dept(public.get_project_department(project_id)))
    )
);

NOTIFY pgrst, 'reload schema';
