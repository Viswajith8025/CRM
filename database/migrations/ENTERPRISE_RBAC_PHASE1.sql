-- ==============================================================================
-- ENTERPRISE RBAC ARCHITECTURE - PHASE 1: DATABASE
-- Run this script in your Supabase SQL Editor
-- ==============================================================================

-- 1. MODULE REGISTRY (Replaces hardcoded sidebar)
CREATE TABLE IF NOT EXISTS public.module_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  route TEXT NOT NULL,
  category TEXT NOT NULL, -- 'top' or 'bottom'
  sort_order INTEGER DEFAULT 0,
  permission TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE
);

-- 2. SUBMODULE REGISTRY (For dynamic features within modules)
CREATE TABLE IF NOT EXISTS public.submodule_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_key TEXT NOT NULL REFERENCES public.module_registry(key) ON DELETE CASCADE,
  key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  route TEXT NOT NULL,
  permission TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- 3. ORGANIZATION FEATURES (Feature flags per org)
CREATE TABLE IF NOT EXISTS public.organization_features (
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  PRIMARY KEY (organization_id, feature_key)
);

-- 4. PERMISSION AUDIT LOGS (To track RBAC changes)
CREATE TABLE IF NOT EXISTS public.permission_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  target_role TEXT,
  action TEXT NOT NULL,
  permission TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. UPGRADE EXISTING PERMISSIONS TABLE
DO $$ BEGIN
  ALTER TABLE public.permissions ADD COLUMN category TEXT DEFAULT 'action';
  ALTER TABLE public.permissions ADD COLUMN submodule TEXT;
  ALTER TABLE public.permissions ADD COLUMN action TEXT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Ensure code is unique so we can upsert safely
DO $$ BEGIN
  ALTER TABLE public.permissions ADD CONSTRAINT permissions_code_key UNIQUE(code);
EXCEPTION WHEN duplicate_table OR unique_violation OR duplicate_object THEN NULL; END $$;

-- 6. AUDIT TRIGGER FOR ROLE PERMISSIONS
CREATE OR REPLACE FUNCTION log_role_permission_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.permission_audit_logs 
    (actor_id, target_role, action, permission, metadata)
  VALUES (
    auth.uid(),
    COALESCE(NEW.role_id, OLD.role_id)::text,
    TG_OP,
    (SELECT code FROM public.permissions WHERE id = COALESCE(NEW.permission_id, OLD.permission_id)),
    jsonb_build_object('table', TG_TABLE_NAME, 'timestamp', now())
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_role_permissions ON public.role_permissions;
CREATE TRIGGER trg_audit_role_permissions
  AFTER INSERT OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION log_role_permission_change();

-- 7. PERFORMANCE INDEXES
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_perms_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_perms_code ON public.permissions(code);
CREATE INDEX IF NOT EXISTS idx_module_registry_perm ON public.module_registry(permission);

-- 8. SEED MODULE REGISTRY
INSERT INTO public.module_registry (key, name, icon, route, category, sort_order, permission)
VALUES
  ('dashboard',  'Dashboard',       'LayoutDashboard', '/',             'top',    0,  'module.dashboard'),
  ('crm',        'CRM Leads',       'Target',          '/crm',          'top',    1,  'module.crm'),
  ('clients',    'Active Clients',  'Users',           '/clients',      'top',    2,  'module.crm'),
  ('projects',   'Projects',        'Briefcase',       '/projects',     'top',    3,  'module.projects'),
  ('tasks',      'Tasks',           'CheckSquare',     '/tasks',        'top',    4,  'module.tasks'),
  ('teams',      'Teams',           'Users2',          '/teams',        'top',    5,  'module.admin'),
  ('billing',    'Billing',         'CreditCard',      '/billing',      'top',    6,  'module.billing'),
  ('renewals',   'Asset Renewals',  'RefreshCw',       '/renewals',     'top',    7,  'module.billing'),
  ('calendar',   'Scheduler',       'Calendar',        '/calendar',     'top',    8,  'module.tasks'),
  ('hr',         'HR & Payroll',    'UserCircle',      '/hr',           'top',    9,  'module.hr'),
  ('reports',    'Reports',         'BarChart3',       '/reports',      'top',    10, 'module.reports'),
  ('documents',  'Document Vault',  'FileBox',         '/documents',    'top',    11, 'module.documents'),
  ('roles',      'Roles & Access',  'ShieldCheck',     '/roles',        'bottom', 0,  'roles.manage'),
  ('superadmin', 'Super Admin',     'ShieldAlert',     '/super-admin',  'bottom', 1,  'super_admin.only'),
  ('audit',      'Audit Trail',     'History',         '/audit-trail',  'bottom', 2,  'module.admin'),
  ('monitor',    'Time Monitor',    'Monitor',         '/time-monitor', 'bottom', 3,  'module.admin'),
  ('timedesk',   'Time Desk',       'Settings2',       '/time-desk/settings', 'bottom', 4, 'module.admin'),
  ('settings',   'Settings',        'Settings',        '/settings',     'bottom', 5,  'module.admin'),
  ('support',    'Support',         'HelpCircle',      '/support',      'bottom', 6,  'module.support'),
  ('timesheet',  'My Timesheet',    'Clock',           '/timesheet',    'top',    12, 'module.timesheet'),
  ('team_timesheets', 'Team Timesheets', 'ClipboardList', '/team-timesheets', 'top', 13, 'module.team_timesheets')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  permission = EXCLUDED.permission;

-- 9. ENABLE RLS ON NEW TABLES
ALTER TABLE public.module_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submodule_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_audit_logs ENABLE ROW LEVEL SECURITY;

-- 10. ADD POLICIES FOR NEW TABLES
DROP POLICY IF EXISTS "Anyone can read module registry" ON public.module_registry;
CREATE POLICY "Anyone can read module registry" ON public.module_registry FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Super admins can manage module registry" ON public.module_registry;
CREATE POLICY "Super admins can manage module registry" ON public.module_registry FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.permission_audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.permission_audit_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin')));

-- 11. ENSURE BASE PERMISSIONS EXIST
INSERT INTO public.permissions (code, module, name, description, category) VALUES 
('module.dashboard', 'Dashboard', 'View Dashboard', 'Access to the main dashboard', 'module'),
('module.crm', 'CRM', 'Access CRM', 'Access to CRM and Clients', 'module'),
('module.projects', 'Projects', 'Access Projects', 'Access to Projects module', 'module'),
('module.tasks', 'Tasks', 'Access Tasks', 'Access to Tasks and Scheduler', 'module'),
('module.billing', 'Billing', 'Access Billing', 'Access to Billing and Renewals', 'module'),
('module.hr', 'HR', 'Access HR', 'Access to HR and Payroll', 'module'),
('module.reports', 'Reports', 'Access Reports', 'Access to all Reporting', 'module'),
('module.documents', 'Documents', 'Access Documents', 'Access to Document Vault', 'module'),
('module.admin', 'Admin', 'Admin Features', 'Access to Team, Settings, Time Desk', 'module'),
('module.support', 'Support', 'Access Support', 'Access to Support Desk', 'module'),
('roles.manage', 'Security', 'Manage Roles', 'Access to Roles & Access Control', 'module'),
('super_admin.only', 'Super Admin', 'Super Admin Access', 'Root access to the system', 'module'),
('module.timesheet', 'Timesheet', 'Access Timesheet', 'Access to My Timesheet', 'module'),
('module.team_timesheets', 'Team Timesheets', 'View Team Timesheets', 'Access to team timesheets', 'module'),
('projects.manage', 'Projects', 'Manage Projects', 'Full project lifecycle control', 'action'),
('projects.edit', 'Projects', 'Edit Projects', 'Ability to modify project details', 'action')
ON CONFLICT (code) DO NOTHING;
