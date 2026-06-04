-- Drop existing overly strict Insert Policy for Tasks
DROP POLICY IF EXISTS "Strict Tenant Isolation: Insert Tasks" ON public.tasks;
DROP POLICY IF EXISTS "Secure Policy: Insert Tasks" ON public.tasks;

-- Recreate policy to allow self-assigned independent tasks
CREATE POLICY "Secure Policy: Insert Tasks" ON public.tasks
  FOR INSERT
  WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (
      -- Super admin or org owner
      (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
      OR EXISTS (SELECT 1 FROM public.organizations WHERE id = organization_id AND owner_id = auth.uid())
      -- Task is assigned to themselves
      OR assigned_to = auth.uid()
      -- User is a member of the project
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = tasks.project_id AND pm.user_id = auth.uid()
      )
      -- User has projects.manage permission
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        JOIN public.roles r ON ur.role_id = r.id
        JOIN public.role_permissions rp ON r.id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = auth.uid() AND p.name = 'projects.manage'
      )
    )
  );
