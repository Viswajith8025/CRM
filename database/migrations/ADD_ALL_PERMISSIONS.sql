-- ==============================================================================
-- ADD ALL MODULES & SUBMODULES TO ROLES & ACCESS
-- ==============================================================================

-- Insert missing or new modules into the permissions table
INSERT INTO public.permissions (code, module, name, description) VALUES
-- Workforce Intelligence (Dashboard Engine)
('workforce.view', 'Workforce', 'View Workforce Cockpit', 'Access to the department intelligence dashboard'),
('workforce.manage_kpis', 'Workforce', 'Manage KPIs', 'Ability to create and edit department performance metrics'),
('workforce.manage_layouts', 'Workforce', 'Manage Dashboard Layouts', 'Customize dashboard grid widgets and templates'),

-- Document Vault
('documents.view', 'Documents', 'View Documents', 'Access to the document vault and files'),
('documents.upload', 'Documents', 'Upload Documents', 'Upload new files to the vault'),
('documents.delete', 'Documents', 'Delete Documents', 'Remove files from the vault'),

-- Automation & Workflows
('automation.view', 'Automation', 'View Automations', 'View configured workflows and triggers'),
('automation.manage', 'Automation', 'Manage Automations', 'Create, edit, and delete workflow automations'),

-- Form Builder
('forms.view', 'Forms', 'View Forms', 'Access form templates and submissions'),
('forms.manage', 'Forms', 'Manage Forms', 'Create and edit dynamic intake forms'),
('forms.submissions', 'Forms', 'Manage Submissions', 'Review and process form submissions'),

-- Marketing & Campaigns
('marketing.view', 'Marketing', 'View Campaigns', 'Access to marketing campaigns and analytics'),
('marketing.manage', 'Marketing', 'Manage Campaigns', 'Create and edit email/SMS marketing flows')

ON CONFLICT (code) DO UPDATE 
SET 
  module = EXCLUDED.module,
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Ensure Super Admin automatically gets these new permissions
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
