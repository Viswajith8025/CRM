-- ==============================================================================
-- ADD MISSING MODULE PERMISSIONS TO CATALOG
-- ==============================================================================

DO $$ 
BEGIN
  -- Insert the module permission for Client Statements
  INSERT INTO public.permissions (id, code, name, description, module, type)
  VALUES 
    (gen_random_uuid(), 'module.statements', 'Client Statements', 'Access to client statements and ledger views.', 'Billing', 'module'),
    (gen_random_uuid(), 'module.audit_trail', 'Audit Trail', 'Access to system-wide audit logs and histories.', 'Security', 'module'),
    (gen_random_uuid(), 'module.roles', 'Roles & Access', 'Access to roles and permissions management.', 'Security', 'module'),
    (gen_random_uuid(), 'module.leave_approvals', 'Leave Approvals', 'Access to leave approvals dashboard.', 'HR', 'module'),
    (gen_random_uuid(), 'module.leave_requests', 'Leave Requests', 'Access to personal leave requests.', 'HR', 'module'),
    (gen_random_uuid(), 'module.teams', 'Teams', 'Access to organization teams management.', 'Admin', 'module')
  ON CONFLICT (code) DO NOTHING;

  -- Reload schema cache
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
