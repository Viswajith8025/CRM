-- ==============================================================================
-- ENTERPRISE RBAC ARCHITECTURE - PHASE 1 (PART 2): DEFAULT PERMISSIONS
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- This script grants the new dynamic module permissions to existing roles

DO $$ 
DECLARE
  employee_role_id UUID;
  admin_role_id UUID;
BEGIN
  -- Get the Role IDs from the roles table (assuming they exist)
  SELECT id INTO employee_role_id FROM public.roles WHERE name = 'employee' LIMIT 1;
  SELECT id INTO admin_role_id FROM public.roles WHERE name = 'admin' LIMIT 1;

  -- 1. GRANT TO EMPLOYEE
  IF employee_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT employee_role_id, p.id 
    FROM public.permissions p
    WHERE p.code IN (
      'module.dashboard',
      'module.projects',
      'module.tasks',
      'module.hr',
      'module.documents',
      'module.timesheet',
      'module.support'
    )
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- 2. GRANT TO ADMIN
  -- Admins get everything except super_admin.only and module.timesheet (they get Team Timesheets instead)
  IF admin_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT admin_role_id, p.id 
    FROM public.permissions p
    WHERE p.code NOT IN ('super_admin.only', 'module.timesheet')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

END $$;
