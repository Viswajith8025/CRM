-- ==============================================================================
-- SEED ALL DYNAMIC MODULES AND SUB-MODULES PERMISSIONS
-- This migration updates the global permissions catalog, maps module registries,
-- and seeds standard preset roles across all organizations to keep RBAC in sync.
-- Run this in your Supabase SQL Editor.
-- ==============================================================================

-- 1. SEED/UPDATE THE GLOBAL PERMISSIONS CATALOG
-- Upserts all core modules (type = 'module') and granular actions (type = 'action')
INSERT INTO public.permissions (code, module, name, description, type) VALUES
  -- ─── MODULES (Sidebar & Shell Visibility) ──────────────────────────────────
  ('module.dashboard', 'General', 'Dashboard Module', 'Access to the main overview dashboard and team workload metrics.', 'module'),
  ('module.crm', 'CRM', 'CRM Module', 'Access to customer relations, leads, and client lists.', 'module'),
  ('module.projects', 'Projects', 'Projects Module', 'Access to company projects, project boards, and milestones.', 'module'),
  ('module.tasks', 'Tasks', 'Tasks Module', 'Access to standard task lists and collaborative work boards.', 'module'),
  ('module.billing', 'Billing', 'Billing Module', 'Access to corporate invoicing, manual billing, and renewals.', 'module'),
  ('module.hr', 'HR', 'HR & Leave Module', 'Access to corporate HR, employee listings, and attendance.', 'module'),
  ('module.reports', 'Reports', 'Reports Module', 'Access to executive financial, operational, and audit reports.', 'module'),
  ('module.documents', 'Documents', 'Document Vault Module', 'Access to secure file repository and documentation storage.', 'module'),
  ('module.calendar', 'Calendar', 'Scheduler Module', 'Access to the interactive corporate calendar and task schedules.', 'module'),
  ('roles.manage', 'Security', 'Roles & Access Module', 'Manage dynamic workspace roles and access control configurations.', 'module'),
  ('super_admin.only', 'Security', 'Super Admin Module', 'Full system access and platform-wide configurations.', 'module'),
  ('module.timesheet', 'Time Tracking', 'My Timesheet Module', 'Access to personal timesheet logs and work session records.', 'module'),
  ('module.team_timesheets', 'Time Tracking', 'Team Timesheets Module', 'Access to review and verify team timesheet entries.', 'module'),
  ('module.time_monitor', 'Time Tracking', 'Time Monitor Module', 'Access to real-time user time monitoring and desktop activity.', 'module'),
  ('module.support', 'Support', 'Support Desk Module', 'Access to internal support requests and system feedback.', 'module'),
  ('module.admin', 'Admin', 'Admin Dashboard Module', 'Access to admin-level team, settings, and workspace controls.', 'module'),

  -- ─── CRM ACTIONS ───────────────────────────────────────────────────────────
  ('crm.view', 'CRM', 'View Leads & Proposals', 'Ability to view the lead lists, pipeline, and proposals.', 'action'),
  ('crm.create_lead', 'CRM', 'Create Lead', 'Ability to add new leads into the sales funnel.', 'action'),
  ('crm.edit_lead', 'CRM', 'Edit Lead', 'Ability to modify existing lead information.', 'action'),
  ('crm.delete_lead', 'CRM', 'Delete Lead', 'Permanently remove leads from the system.', 'action'),
  ('crm.clients.manage', 'CRM', 'Manage Clients', 'Convert leads to clients and update active customer directories.', 'action'),
  ('crm.proposals.manage', 'CRM', 'Manage Proposals', 'Create, send, and edit business proposals.', 'action'),
  ('crm.proposals.esign', 'CRM', 'E-Sign Proposals', 'Electronically sign and approve business proposals.', 'action'),

  -- ─── PROJECT ACTIONS ───────────────────────────────────────────────────────
  ('projects.view', 'Projects', 'View Projects', 'Ability to view active organization projects.', 'action'),
  ('projects.create', 'Projects', 'Create Project', 'Ability to initialize new corporate projects.', 'action'),
  ('projects.edit', 'Projects', 'Edit Project', 'Ability to edit project metadata and fields.', 'action'),
  ('projects.manage', 'Projects', 'Manage Project Settings', 'Delete, archive, and manage high-level project parameters.', 'action'),
  ('projects.milestones.manage', 'Projects', 'Manage Milestones', 'Create, edit, and delete project milestones.', 'action'),
  ('projects.modules.manage', 'Projects', 'Manage Project Modules', 'Classify projects into modules and sub-modules.', 'action'),

  -- ─── TASK ACTIONS ──────────────────────────────────────────────────────────
  ('tasks.view', 'Tasks', 'View Tasks', 'Ability to view and filter workspace tasks.', 'action'),
  ('tasks.create', 'Tasks', 'Create Task', 'Ability to add new tasks to project lists.', 'action'),
  ('tasks.assign', 'Tasks', 'Assign Tasks', 'Ability to assign tasks to active employees.', 'action'),
  ('tasks.manage_all', 'Tasks', 'Manage All Tasks', 'Edit or delete tasks assigned to other team members.', 'action'),

  -- ─── BILLING ACTIONS ───────────────────────────────────────────────────────
  ('billing.view', 'Billing', 'View Financials', 'Ability to view invoices, financials, and transaction histories.', 'action'),
  ('billing.invoices.create', 'Billing', 'Create Invoices', 'Generate client invoices and configure rates.', 'action'),
  ('billing.invoices.delete', 'Billing', 'Delete Invoices', 'Delete, void, or cancel generated invoices.', 'action'),
  ('billing.payments.record', 'Billing', 'Record Payments', 'Log client payments and reconcile ledger files.', 'action'),
  ('renewals.manage', 'Billing', 'Manage Asset Renewals', 'Track and update dynamic asset or subscription renewals.', 'action'),

  -- ─── HR ACTIONS ────────────────────────────────────────────────────────────
  ('hr.view', 'HR', 'View HR Directory', 'Access the employee rosters, profiles, and hierarchy charts.', 'action'),
  ('hr.manage_attendance', 'HR', 'Manage Attendance', 'View and modify team work hours and attendance cards.', 'action'),
  ('hr.approve_leave', 'HR', 'Approve/Reject Leave', 'Approve or deny employee paid time off (PTO) requests.', 'action'),
  ('leave.approval.view', 'HR', 'View Leave Approvals Manager', 'Access the high-level manager leave request queue.', 'action'),
  ('leave.request.create', 'HR', 'Create Leave Request', 'Request leaves of absence and vacation cycles.', 'action'),

  -- ─── REPORTS ACTIONS ───────────────────────────────────────────────────────
  ('reports.view', 'Reports', 'View Reports Directory', 'Access the analytics reports listing dashboard.', 'action'),
  ('reports.financial', 'Reports', 'Run Financial Reports', 'Generate revenue, invoice, payment, and profitability statistics.', 'action'),
  ('reports.performance', 'Reports', 'Run Performance Reports', 'Generate employee workloads, task delivery, and timesheet reports.', 'action'),
  ('reports.audit', 'Reports', 'Run Audit & Security Reports', 'Inspect workspace audit logs, action histories, and records.', 'action'),

  -- ─── DOCUMENTS ACTIONS ─────────────────────────────────────────────────────
  ('documents.view', 'Documents', 'View Document Vault', 'Browse files, directories, and sheets inside the vault.', 'action'),
  ('documents.upload', 'Documents', 'Upload Documents', 'Upload corporate materials to the document cloud.', 'action'),
  ('documents.delete', 'Documents', 'Delete Documents', 'Permanently remove files from the organization vault.', 'action'),

  -- ─── ADMIN ACTIONS ─────────────────────────────────────────────────────────
  ('admin.team.manage', 'Admin', 'Manage Organization Roster', 'Invite users, assign roles, and handle team structures.', 'action'),
  ('admin.settings.manage', 'Admin', 'Manage Company Settings', 'Update profile settings, brand logos, and systems configs.', 'action'),
  ('admin.timedesk.manage', 'Admin', 'Manage Time Desk Settings', 'Configure work session limits, break cycles, and screenshot frequency.', 'action')
ON CONFLICT (code) DO UPDATE SET
  module = EXCLUDED.module,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  type = EXCLUDED.type;


-- 2. RE-ALIGN SIDEBAR MODULE REGISTRY WITH DYNAMIC PERMISSIONS
-- Syncs all sidebar items in the database with their respective dynamic permission gates
INSERT INTO public.module_registry (key, name, icon, route, category, sort_order, permission)
VALUES
  ('dashboard',       'Dashboard',       'LayoutDashboard', '/',                    'top',    0,  'module.dashboard'),
  ('crm',             'CRM Leads',       'Target',          '/crm',                 'top',    1,  'module.crm'),
  ('clients',         'Active Clients',  'Users',           '/clients',             'top',    2,  'module.crm'),
  ('projects',        'Projects',        'Briefcase',       '/projects',            'top',    3,  'module.projects'),
  ('tasks',           'Tasks',           'CheckSquare',     '/tasks',               'top',    4,  'module.tasks'),
  ('teams',           'Teams',           'Users2',          '/teams',               'top',    5,  'module.admin'),
  ('billing',         'Billing',         'CreditCard',      '/billing',             'top',    6,  'module.billing'),
  ('renewals',        'Asset Renewals',  'RefreshCw',       '/renewals',            'top',    7,  'module.billing'),
  ('calendar',        'Scheduler',       'Calendar',        '/calendar',            'top',    8,  'module.calendar'),
  ('hr',              'HR & Payroll',    'UserCircle',      '/hr',                  'top',    9,  'module.hr'),
  ('reports',         'Reports',         'BarChart3',       '/reports',             'top',    10, 'module.reports'),
  ('documents',       'Document Vault',  'FileBox',         '/documents',           'top',    11, 'module.documents'),
  ('timesheet',       'My Timesheet',    'Clock',           '/timesheet',           'top',    12, 'module.timesheet'),
  ('team_timesheets', 'Team Timesheets', 'ClipboardList',   '/team-timesheets',     'top',    13, 'module.team_timesheets'),
  ('roles',           'Roles & Access',  'ShieldCheck',     '/roles',               'bottom', 0,  'roles.manage'),
  ('superadmin',      'Super Admin',     'ShieldAlert',     '/super-admin',         'bottom', 1,  'super_admin.only'),
  ('audit',           'Audit Trail',     'History',         '/audit-trail',         'bottom', 2,  'module.admin'),
  ('monitor',         'Time Monitor',    'Monitor',         '/time-monitor',        'bottom', 3,  'module.admin'),
  ('timedesk',        'Time Desk',       'Settings2',       '/time-desk/settings',  'bottom', 4,  'module.admin'),
  ('settings',        'Settings',        'Settings',        '/settings',            'bottom', 5,  'module.admin'),
  ('support',         'Support',         'HelpCircle',      '/support',             'bottom', 6,  'module.support')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  permission = EXCLUDED.permission;


-- 3. PROPAGATE AND ASSIGN NEW DYNAMIC PERMISSIONS TO STANDARD ROLES
-- Makes sure Super Admin, Administrator, HR, and Employee roles have proper default access levels in sync.
DO $$
DECLARE
  org_rec RECORD;
  super_admin_role_id UUID;
  admin_role_id UUID;
  hr_role_id UUID;
  employee_role_id UUID;
BEGIN
  -- Iterate through each organization to update roles and permissions
  FOR org_rec IN SELECT id FROM public.organizations LOOP

    -- Ensure 'Super Admin' role exists for this organization
    SELECT id INTO super_admin_role_id FROM public.roles WHERE organization_id = org_rec.id AND name = 'Super Admin';
    IF super_admin_role_id IS NULL THEN
      INSERT INTO public.roles (organization_id, name, description, is_system)
      VALUES (org_rec.id, 'Super Admin', 'Full system access and platform management', true)
      RETURNING id INTO super_admin_role_id;
    END IF;

    -- Ensure 'Administrator' role exists
    SELECT id INTO admin_role_id FROM public.roles WHERE organization_id = org_rec.id AND name = 'Administrator';
    IF admin_role_id IS NULL THEN
      INSERT INTO public.roles (organization_id, name, description, is_system)
      VALUES (org_rec.id, 'Administrator', 'Full organization access and team management', true)
      RETURNING id INTO admin_role_id;
    END IF;

    -- Ensure 'HR' role exists
    SELECT id INTO hr_role_id FROM public.roles WHERE organization_id = org_rec.id AND name = 'HR';
    IF hr_role_id IS NULL THEN
      INSERT INTO public.roles (organization_id, name, description, is_system)
      VALUES (org_rec.id, 'HR', 'Manage employee directory, attendance, and leaves', true)
      RETURNING id INTO hr_role_id;
    END IF;

    -- Ensure 'Employee' role exists
    SELECT id INTO employee_role_id FROM public.roles WHERE organization_id = org_rec.id AND name = 'Employee';
    IF employee_role_id IS NULL THEN
      INSERT INTO public.roles (organization_id, name, description, is_system)
      VALUES (org_rec.id, 'Employee', 'Standard workspace access for operations', true)
      RETURNING id INTO employee_role_id;
    END IF;

    -- A. Grant ALL permissions to Super Admin role
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT super_admin_role_id, id FROM public.permissions
    ON CONFLICT DO NOTHING;

    -- B. Grant Administrator role all permissions except super_admin.only
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT admin_role_id, id FROM public.permissions
    WHERE code != 'super_admin.only'
    ON CONFLICT DO NOTHING;

    -- C. Grant HR role HR, Reporting, Dashboard, and leave request permissions
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT hr_role_id, id FROM public.permissions
    WHERE code IN (
      'module.dashboard',
      'module.hr',
      'module.reports',
      'module.timesheet',
      'module.team_timesheets',
      'module.calendar',
      'module.support',
      'hr.view',
      'hr.manage_attendance',
      'hr.approve_leave',
      'leave.approval.view',
      'leave.request.create',
      'reports.view',
      'reports.performance'
    )
    ON CONFLICT DO NOTHING;

    -- D. Grant Employee role standard operatory and personal tools access
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT employee_role_id, id FROM public.permissions
    WHERE code IN (
      'module.dashboard',
      'module.projects',
      'module.tasks',
      'module.calendar',
      'module.timesheet',
      'module.support',
      'projects.view',
      'tasks.view',
      'leave.request.create'
    )
    ON CONFLICT DO NOTHING;

  END LOOP;
END $$;

-- 4. REFRESH SCHEMA & SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
