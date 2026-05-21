-- ==============================================================================
-- ENTERPRISE PROJECT SCOPING (RLS ENFORCEMENT)
-- ==============================================================================
-- Enforces strict Row Level Security on projects.
-- Prevents employees from accessing projects outside their department,
-- unless they are explicitly assigned to the project or have manage permissions.

-- 0. Ensure the department_id column exists on projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- 1. Drop the legacy overly-permissive policy
DROP POLICY IF EXISTS "Projects View Permission" ON public.projects;

-- 2. Create the strict department-scoped policy
CREATE POLICY "Projects View Permission" ON public.projects 
    FOR SELECT USING (
        -- Must have baseline view permission
        public.has_permission('projects.view') 
        AND (
            -- Condition A: User has full management rights over projects (Admin/HR/Manager)
            public.has_permission('projects.manage')
            
            -- Condition B: User belongs to the project's department
            OR department_id IN (
                SELECT department_id 
                FROM public.department_members 
                WHERE profile_id = auth.uid()
            )
            
            -- Condition C: User is explicitly a member of the project team
            OR id IN (
                SELECT project_id 
                FROM public.project_members 
                WHERE user_id = auth.uid()
            )

            -- Condition D: Project has no department (Global project, visible to all with view perm)
            OR department_id IS NULL
        )
    );
