-- ==============================================================================
-- DEPARTMENT MANAGEMENT HARDENING
-- Adds soft-delete, audit columns, and management permission to departments.
-- Run this in your Supabase SQL Editor BEFORE deploying the frontend changes.
-- ==============================================================================

-- 1. Add missing columns to departments table
ALTER TABLE public.departments
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_departments_status   ON public.departments(status);
CREATE INDEX IF NOT EXISTS idx_departments_deleted  ON public.departments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_departments_org_name ON public.departments(organization_id, name);

-- 3. Add department management permission to the global catalog
INSERT INTO public.permissions (code, module, name, description, type) VALUES
  ('departments.manage', 'Admin', 'Manage Departments', 'Create, edit, activate, and disable organization departments.', 'action')
ON CONFLICT (code) DO UPDATE SET
  module      = EXCLUDED.module,
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  type        = EXCLUDED.type;

-- 4. Grant `departments.manage` to Super Admin and Administrator roles in all orgs
DO $$
DECLARE
  org_rec              RECORD;
  perm_id              UUID;
  super_admin_role_id  UUID;
  admin_role_id        UUID;
BEGIN
  -- Get the permission ID
  SELECT id INTO perm_id FROM public.permissions WHERE code = 'departments.manage';

  IF perm_id IS NULL THEN
    RAISE NOTICE 'Permission departments.manage not found, skipping role grants.';
    RETURN;
  END IF;

  FOR org_rec IN SELECT id FROM public.organizations LOOP

    -- Super Admin
    SELECT id INTO super_admin_role_id
      FROM public.roles WHERE organization_id = org_rec.id AND name = 'Super Admin';
    IF super_admin_role_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (super_admin_role_id, perm_id)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Administrator
    SELECT id INTO admin_role_id
      FROM public.roles WHERE organization_id = org_rec.id AND name = 'Administrator';
    IF admin_role_id IS NOT NULL THEN
      INSERT INTO public.role_permissions (role_id, permission_id)
      VALUES (admin_role_id, perm_id)
      ON CONFLICT DO NOTHING;
    END IF;

  END LOOP;
END $$;

-- 5. Seed the module_registry so the Departments tab appears in admin navigation (optional)
-- This is frontend-driven via SettingsPage tab so no new route needed.

-- 6. Refresh schema cache
NOTIFY pgrst, 'reload schema';
