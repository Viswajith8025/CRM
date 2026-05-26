-- ==============================================================================
-- ANALYSIS AND SYNC: ALL MODULES & PERMISSIONS
-- This adds any newly created modules (Forms, Client Portal, Automation, Workforce)
-- into the permissions table and module registry so they appear in Roles & Access.
-- ==============================================================================

-- 1. Ensure all new modules exist in the permissions table
INSERT INTO public.permissions (code, module, name, description, type) VALUES
  -- Forms Builder
  ('module.forms', 'Forms', 'Form Builder Module', 'Access to the dynamic form builder and client intake forms.', 'module'),
  ('forms.create', 'Forms', 'Create Forms', 'Ability to build new dynamic forms.', 'action'),
  ('forms.submissions.view', 'Forms', 'View Submissions', 'Ability to review form submissions.', 'action'),

  -- Automation
  ('module.automation', 'Automation', 'Automation Module', 'Access to workflow automations and triggers.', 'module'),
  ('automation.manage', 'Automation', 'Manage Automations', 'Ability to create and manage workflows.', 'action'),

  -- Workforce Cockpit
  ('module.workforce', 'Workforce', 'Workforce Cockpit', 'Access to the real-time workforce intelligence cockpit.', 'module'),
  ('workforce.manage', 'Workforce', 'Manage Workforce', 'Ability to manage KPIs and metrics.', 'action'),

  -- Client Portal Settings
  ('module.client_portal', 'Client Portal', 'Client Portal Settings', 'Access to client portal configuration.', 'module'),
  ('client_portal.manage', 'Client Portal', 'Manage Portal', 'Manage client portal themes and branding.', 'action')

ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type;


-- 2. Ensure the new modules are in the module_registry
INSERT INTO public.module_registry (key, name, icon, route, category, sort_order, permission)
VALUES
  ('forms', 'Form Builder', 'ClipboardList', '/forms', 'top', 14, 'module.forms'),
  ('automation', 'Automations', 'Settings2', '/automations', 'top', 15, 'module.automation'),
  ('workforce', 'Workforce', 'Activity', '/workforce', 'top', 16, 'module.workforce'),
  ('client_portal', 'Portal Setup', 'Monitor', '/portal-settings', 'bottom', 7, 'module.client_portal')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  category = EXCLUDED.category,
  permission = EXCLUDED.permission;

-- 3. Grant Super Admin access to all new permissions automatically
DO $$
DECLARE
    super_admin_role_id UUID;
    perm RECORD;
BEGIN
    FOR super_admin_role_id IN SELECT id FROM public.roles WHERE name = 'Super Admin' LOOP
        FOR perm IN SELECT id FROM public.permissions LOOP
            INSERT INTO public.role_permissions (role_id, permission_id)
            VALUES (super_admin_role_id, perm.id)
            ON CONFLICT DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
