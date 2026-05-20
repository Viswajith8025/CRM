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
    code TEXT UNIQUE NOT NULL, -- e.g. 'module.crm', 'action.create_lead'
    module TEXT NOT NULL, -- e.g. 'CRM', 'Billing'
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'action', -- 'module' or 'action'
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

-- 5. Enterprise Permission Catalog
-- Codes now follow 'module.[name]' and 'action.[name]' pattern
INSERT INTO public.permissions (code, module, name, description, type) VALUES
-- Module Access (Sidebar & Dashboard Visibility)
('module.dashboard', 'General', 'Dashboard Access', 'View the main overview dashboard', 'module'),
('module.crm', 'CRM', 'CRM Module', 'Access to Lead & Proposal Management', 'module'),
('module.projects', 'Projects', 'Projects Module', 'Access to Project & Task Management', 'module'),
('module.billing', 'Billing', 'Billing Module', 'Access to Invoices & Financials', 'module'),
('module.hr', 'HR', 'HR Module', 'Access to Employee Directory & Leave', 'module'),
('module.reports', 'Reports', 'Reports Module', 'Access to Analytics & Audits', 'module'),
('module.admin', 'Admin', 'Admin Module', 'Access to System Settings & RBAC', 'module'),

-- CRM Actions
('crm.create_lead', 'CRM', 'Create Lead', 'Add new leads to the system', 'action'),
('crm.edit_lead', 'CRM', 'Edit Lead', 'Modify existing lead data', 'action'),
('crm.delete_lead', 'CRM', 'Delete Lead', 'Permanently remove leads', 'action'),

-- Project Actions
('projects.create', 'Projects', 'Create Project', 'Initialize new enterprise projects', 'action'),
('projects.manage', 'Projects', 'Manage Project', 'Settings, archiving, and deletion', 'action'),
('tasks.create', 'Tasks', 'Create Task', 'Add tasks within projects', 'action'),
('tasks.assign', 'Tasks', 'Assign Task', 'Delegate tasks to team members', 'action'),

-- Billing Actions
('billing.create_invoice', 'Billing', 'Create Invoice', 'Generate client invoices', 'action'),
('billing.manage_payments', 'Billing', 'Manage Payments', 'Record and verify payments', 'action'),

-- HR Actions
('hr.manage_attendance', 'HR', 'Manage Attendance', 'View and edit team attendance', 'action'),
('hr.approve_leave', 'HR', 'Approve Leave', 'Decision making on leave requests', 'action'),

-- Admin Actions
('roles.manage', 'Admin', 'Manage RBAC', 'Create, edit, and assign roles', 'action')
ON CONFLICT (code) DO UPDATE SET 
    module = EXCLUDED.module,
    name = EXCLUDED.name,
    type = EXCLUDED.type;

-- 6. Enterprise-Grade Permission Checker
DROP FUNCTION IF EXISTS public.has_permission(text) CASCADE;
CREATE OR REPLACE FUNCTION public.has_permission(permission_code TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role TEXT;
    v_has_perm BOOLEAN;
BEGIN
    -- 1. Super Admin Bypass (Legacy & Platform Support)
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    IF v_user_role = 'super_admin' THEN
        RETURN TRUE;
    END IF;

    -- 2. Dynamic RBAC Check
    SELECT EXISTS (
        SELECT 1 
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = auth.uid()
        AND p.code = permission_code
    ) INTO v_has_perm;
    
    RETURN COALESCE(v_has_perm, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Add RLS for RBAC tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage roles" ON public.roles
    FOR ALL USING (public.has_permission('roles.manage')) WITH CHECK (public.has_permission('roles.manage'));

CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
    FOR ALL USING (public.has_permission('roles.manage')) WITH CHECK (public.has_permission('roles.manage'));

CREATE POLICY "Admins can manage user roles" ON public.user_roles
    FOR ALL USING (public.has_permission('roles.manage')) WITH CHECK (public.has_permission('roles.manage'));

CREATE POLICY "Users can view their own roles" ON public.user_roles
    FOR SELECT USING (user_id = auth.uid());

-- 9. Update Core Table RLS Policies to use Dynamic RBAC
-- This ensures that modules (Leads, Invoices, etc.) respect the dynamic permissions you set.

-- LEADS
DROP POLICY IF EXISTS "Leads View Permission" ON public.leads;
CREATE POLICY "Leads View Permission" ON public.leads 
    FOR SELECT USING (public.has_permission('crm.view'));

-- INVOICES
DROP POLICY IF EXISTS "Invoices View Permission" ON public.invoices;
CREATE POLICY "Invoices View Permission" ON public.invoices 
    FOR SELECT USING (public.has_permission('billing.view'));

-- PROJECTS
DROP POLICY IF EXISTS "Projects View Permission" ON public.projects;
CREATE POLICY "Projects View Permission" ON public.projects 
    FOR SELECT USING (public.has_permission('projects.view'));

-- TASKS
DROP POLICY IF EXISTS "Tasks View Permission" ON public.tasks;
CREATE POLICY "Tasks View Permission" ON public.tasks 
    FOR SELECT USING (public.has_permission('tasks.view'));

-- PERMISSIONS
DROP POLICY IF EXISTS "Everyone can view permissions" ON public.permissions;
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
    hr_role_id UUID;
    roles_manage_perm_id UUID;
BEGIN
    SELECT id INTO roles_manage_perm_id FROM public.permissions WHERE code = 'roles.manage';

    FOR org_id IN SELECT id FROM public.organizations LOOP
        -- 1. Ensure Super Admin Role exists and get ID
        INSERT INTO public.roles (organization_id, name, description, is_system)
        VALUES (org_id, 'Super Admin', 'Full system access and platform management', true)
        ON CONFLICT (organization_id, name) DO UPDATE SET is_system = true;
        SELECT id INTO super_admin_role_id FROM public.roles WHERE organization_id = org_id AND name = 'Super Admin';

        -- 2. Ensure Administrator Role exists and get ID
        INSERT INTO public.roles (organization_id, name, description, is_system)
        VALUES (org_id, 'Administrator', 'Full organization access and team management', true)
        ON CONFLICT (organization_id, name) DO UPDATE SET is_system = true;
        SELECT id INTO admin_role_id FROM public.roles WHERE organization_id = org_id AND name = 'Administrator';

        -- 3. Ensure Employee Role exists and get ID
        INSERT INTO public.roles (organization_id, name, description, is_system)
        VALUES (org_id, 'Employee', 'Standard workspace access for operations', true)
        ON CONFLICT (organization_id, name) DO UPDATE SET is_system = true;
        SELECT id INTO employee_role_id FROM public.roles WHERE organization_id = org_id AND name = 'Employee';

        -- 4. Ensure HR Role exists and get ID
        INSERT INTO public.roles (organization_id, name, description, is_system)
        VALUES (org_id, 'HR', 'Manage employee directory, attendance and leave', true)
        ON CONFLICT (organization_id, name) DO UPDATE SET is_system = true;
        SELECT id INTO hr_role_id FROM public.roles WHERE organization_id = org_id AND name = 'HR';

        -- 5. Grant ALL permissions to Super Admin
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT super_admin_role_id, id FROM public.permissions
        ON CONFLICT DO NOTHING;

        -- 6. Seed Administrator Presets
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT admin_role_id, id FROM public.permissions
        WHERE code NOT LIKE 'roles.manage' -- Admins can't edit roles by default, only Super Admins
        ON CONFLICT DO NOTHING;

        -- 7. Seed HR Presets (Complete HR Workspace)
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT hr_role_id, id FROM public.permissions
        WHERE code IN (
            'module.dashboard', 'module.hr', 'module.reports',
            'hr.manage_attendance', 'hr.approve_leave'
        )
        ON CONFLICT DO NOTHING;

        -- 8. Seed Employee Presets (Personal Workspace)
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT employee_role_id, id FROM public.permissions
        WHERE code IN (
            'module.dashboard', 'module.projects'
        )
        ON CONFLICT DO NOTHING;

        -- 9. Map existing profiles to new roles
        INSERT INTO public.user_roles (user_id, role_id)
        SELECT p.id, 
            CASE 
                WHEN p.role = 'super_admin' THEN super_admin_role_id
                WHEN p.role = 'admin' THEN admin_role_id
                WHEN p.role = 'manager' THEN hr_role_id
                ELSE employee_role_id
            END
        FROM public.profiles p
        WHERE p.organization_id = org_id
        AND (p.role IN ('super_admin', 'admin', 'employee', 'manager') OR p.role IS NULL)
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;
