
-- Add permissions for Renewals module
INSERT INTO public.permissions (code, module, name, description)
VALUES 
('module.renewals', 'Renewals', 'Renewals Module', 'Access to track hosting, domain, and mail renewals.'),
('renewals.manage', 'Renewals', 'Manage Renewals', 'Ability to create, update, and delete renewal records.'),
('renewals.reminder', 'Renewals', 'Send Reminders', 'Ability to trigger manual email reminders to clients.')
ON CONFLICT (code) DO NOTHING;
