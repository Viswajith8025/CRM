-- RBAC System Migration
-- This script sets up dynamic roles and permissions.

-- CLEANUP (Ensures we have a clean slate for the new architecture)
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;

-- 1. Permissions Table (Static Catalog of all possible actions)
CREATE TABLE public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL, -- e.g. 'crm.view', 'billing.create_invoice'
    module TEXT NOT NULL, -- e.g. 'CRM', 'Billing'
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Roles Table (Dynamic, scoped to organization)
CREATE TABLE public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT false, -- True for 'Super Admin', 'Admin', 'Employee' defaults
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, name)
);

-- 3. Role Permissions (Many-to-Many mapping)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 4. User Roles (Linking profiles to roles)
-- We will add a role_id to profiles, or use this table for many-to-many.
-- For a real ERP, a user might have multiple roles (e.g. 'Manager' + 'HR Admin').
CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- 5. Seed Initial Permissions
INSERT INTO public.permissions (code, module, name, description) VALUES
-- CRM
('crm.view', 'CRM', 'View CRM', 'Access to leads and proposals'),
('crm.create_lead', 'CRM', 'Create Lead', 'Ability to add new leads'),
('crm.edit_lead', 'CRM', 'Edit Lead', 'Modify existing leads'),
('crm.delete_lead', 'CRM', 'Delete Lead', 'Remove leads from system'),
-- Projects
('projects.view', 'Projects', 'View Projects', 'Access to project list'),
('projects.create', 'Projects', 'Create Project', 'Initialize new projects'),
('projects.manage', 'Projects', 'Manage Project', 'Edit, archive and manage settings'),
-- Tasks
('tasks.view', 'Tasks', 'View Tasks', 'Access to task lists'),
('tasks.create', 'Tasks', 'Create Task', 'Add new tasks'),
('tasks.assign', 'Tasks', 'Assign Task', 'Assign tasks to team members'),
('tasks.delete', 'Tasks', 'Delete Task', 'Remove tasks'),
-- Billing
('billing.view', 'Billing', 'View Billing', 'Access to invoices and financial data'),
('billing.create_invoice', 'Billing', 'Create Invoice', 'Generate new invoices'),
('billing.manage_payments', 'Billing', 'Manage Payments', 'Record payments and update status'),
-- HR
('hr.view', 'HR', 'View HR', 'Access to employee directory and HR dashboard'),
('hr.manage_attendance', 'HR', 'Manage Attendance', 'View and edit attendance logs'),
('hr.approve_leave', 'HR', 'Approve Leave', 'Approve or decline leave requests'),
-- Support
('support.view', 'Support', 'View Support', 'Access to support tickets'),
('support.manage_tickets', 'Support', 'Manage Tickets', 'Reply, close and assign tickets'),
-- Reports
('reports.view', 'Reports', 'View Reports', 'Access to reporting center'),
('reports.export', 'Reports', 'Export Reports', 'Download CSV/PDF reports'),
-- Roles Management (The new module)
('roles.manage', 'Admin', 'Manage Roles', 'Create and edit roles and permissions')
ON CONFLICT (code) DO NOTHING;

-- 6. Helper Function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(permission_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    user_has_perm BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = auth.uid()
        AND p.code = permission_code
    ) INTO user_has_perm;
    
    RETURN user_has_perm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Add RLS for RBAC tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage roles" ON public.roles
    FOR ALL USING (public.has_permission('roles.manage')) WITH CHECK (public.has_permission('roles.manage'));

CREATE POLICY "Everyone can view permissions" ON public.permissions
    FOR SELECT USING (true);

-- 8. Seed Default Roles for Organization
-- This logic should ideally run per organization, but we seed defaults for existing ones.
DO $$
DECLARE
    org_id UUID;
    super_admin_role_id UUID;
    admin_role_id UUID;
    employee_role_id UUID;
    roles_manage_perm_id UUID;
BEGIN
    SELECT id INTO roles_manage_perm_id FROM public.permissions WHERE code = 'roles.manage';

    FOR org_id IN SELECT id FROM public.organizations LOOP
        -- Create Super Admin Role
        INSERT INTO public.roles (organization_id, name, description, is_system)
        VALUES (org_id, 'Super Admin', 'Full system access and platform management', true)
        ON CONFLICT (organization_id, name) DO UPDATE SET is_system = true
        RETURNING id INTO super_admin_role_id;

        -- Create Admin Role
        INSERT INTO public.roles (organization_id, name, description, is_system)
        VALUES (org_id, 'Administrator', 'Full organization access and team management', true)
        ON CONFLICT (organization_id, name) DO UPDATE SET is_system = true
        RETURNING id INTO admin_role_id;

        -- Create Employee Role
        INSERT INTO public.roles (organization_id, name, description, is_system)
        VALUES (org_id, 'Employee', 'Standard workspace access for operations', true)
        ON CONFLICT (organization_id, name) DO UPDATE SET is_system = true
        RETURNING id INTO employee_role_id;

        -- Grant ALL permissions to Super Admin
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT super_admin_role_id, id FROM public.permissions
        ON CONFLICT DO NOTHING;

        -- Map existing profiles to new roles based on legacy 'role' text field
        INSERT INTO public.user_roles (user_id, role_id)
        SELECT p.id, 
            CASE 
                WHEN p.role = 'super_admin' THEN super_admin_role_id
                WHEN p.role = 'admin' THEN admin_role_id
                ELSE employee_role_id
            END
        FROM public.profiles p
        WHERE p.organization_id = org_id
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
