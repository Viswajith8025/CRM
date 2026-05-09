-- ==============================================================================
-- RBAC (Role-Based Access Control) SYSTEM MIGRATION
-- ==============================================================================

-- 1. PERMISSIONS TABLE (Global list of possible actions)
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY, -- e.g., 'invoices.create', 'projects.delete'
  description TEXT,
  module TEXT, -- e.g., 'billing', 'projects', 'crm'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ROLES TABLE (Customizable roles per organization)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organization_settings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false, -- If true, cannot be deleted (e.g., 'Owner')
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- 3. ROLE_PERMISSIONS (Join table)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 4. PROFILE_ROLES (Assign roles to users)
CREATE TABLE IF NOT EXISTS profile_roles (
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, role_id)
);

-- 5. HELPER FUNCTION: Check if user has permission
CREATE OR REPLACE FUNCTION public.has_permission(p_permission_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM profile_roles pr
    JOIN role_permissions rp ON pr.role_id = rp.role_id
    WHERE pr.profile_id = auth.uid()
    AND rp.permission_id = p_permission_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. SEED INITIAL PERMISSIONS
INSERT INTO permissions (id, module, description) VALUES
  ('crm.leads.create', 'crm', 'Create new leads'),
  ('crm.leads.delete', 'crm', 'Delete leads'),
  ('crm.clients.manage', 'crm', 'Convert leads to clients and edit them'),
  ('projects.create', 'projects', 'Create new projects'),
  ('projects.delete', 'projects', 'Delete projects'),
  ('projects.milestones.manage', 'projects', 'Create and edit milestones'),
  ('tasks.manage_all', 'tasks', 'Edit or delete tasks assigned to others'),
  ('billing.invoices.create', 'billing', 'Generate new invoices'),
  ('billing.invoices.delete', 'billing', 'Delete or cancel invoices'),
  ('billing.payments.record', 'billing', 'Record payments and view financial summaries'),
  ('admin.team.manage', 'admin', 'Invite users and change their roles'),
  ('admin.settings.manage', 'admin', 'Update organization company settings')
ON CONFLICT (id) DO NOTHING;

-- 7. ENABLE RLS
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_roles ENABLE ROW LEVEL SECURITY;

-- 8. RLS POLICIES
DROP POLICY IF EXISTS "permissions_read_all" ON permissions;
CREATE POLICY "permissions_read_all" ON permissions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "roles_org_isolation" ON roles;
CREATE POLICY "roles_org_isolation" ON roles FOR ALL TO authenticated USING (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "role_perms_org_isolation" ON role_permissions;
CREATE POLICY "role_perms_org_isolation" ON role_permissions FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM roles WHERE id = role_id AND organization_id = public.get_my_org_id()));

DROP POLICY IF EXISTS "profile_roles_org_isolation" ON profile_roles;
CREATE POLICY "profile_roles_org_isolation" ON profile_roles FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = profile_id AND organization_id = public.get_my_org_id()));

-- 9. MIGRATION STEP: Assign default roles to existing users based on their legacy 'role' column
-- This would be done via a script or manual migration, but here's the logic:
-- 1. Create 'Admin' role for each org.
-- 2. Map all permissions to 'Admin'.
-- 3. Link profiles with role='admin' to the 'Admin' role.
