-- ==============================================================================
-- HEAL PERMISSIONS & RBAC RECOVERY
-- Fixes missing '.view' permissions that are blocking module visibility
-- ==============================================================================

-- 1. Add missing view permissions to catalog
INSERT INTO public.permissions (code, module, name, description, type) VALUES
('crm.view', 'CRM', 'View Leads', 'Ability to view the lead list and details', 'action'),
('projects.view', 'Projects', 'View Projects', 'Ability to view project list and details', 'action'),
('tasks.view', 'Tasks', 'View Tasks', 'Ability to view task lists', 'action'),
('billing.view', 'Billing', 'View Invoices', 'Ability to view invoices and financials', 'action')
ON CONFLICT (code) DO NOTHING;

-- 2. Grant these permissions to existing roles
-- We need to ensure that Super Admin, Administrator, and Employee roles get these by default.

DO $$
DECLARE
    super_admin_perm_id UUID;
    admin_perm_id UUID;
    employee_perm_id UUID;
    p_code TEXT;
    r RECORD;
BEGIN
    FOR r IN SELECT id, code FROM public.permissions WHERE code IN ('crm.view', 'projects.view', 'tasks.view', 'billing.view') LOOP
        
        -- Grant to all Super Admin roles across all orgs
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT id, r.id FROM public.roles WHERE name = 'Super Admin'
        ON CONFLICT DO NOTHING;

        -- Grant to all Administrator roles
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT id, r.id FROM public.roles WHERE name = 'Administrator'
        ON CONFLICT DO NOTHING;

        -- Grant specific view permissions to Employees (Projects & Tasks)
        IF r.code IN ('projects.view', 'tasks.view') THEN
            INSERT INTO public.role_permissions (role_id, permission_id)
            SELECT id, r.id FROM public.roles WHERE name = 'Employee'
            ON CONFLICT DO NOTHING;
        END IF;

    END LOOP;
END $$;

-- 3. Audit Check: Ensure leads/projects aren't being blocked by other conditions
-- Refresh schema
NOTIFY pgrst, 'reload schema';
