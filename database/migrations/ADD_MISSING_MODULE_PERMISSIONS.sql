-- ==============================================================================
-- ADD MISSING MODULE PERMISSIONS TO CATALOG
-- ==============================================================================

DO $$ 
BEGIN
  -- Insert the module permission for Client Statements
  INSERT INTO public.permissions (id, code, description, module)
  VALUES 
    (gen_random_uuid(), 'module.statements', 'Access to client statements and ledger views.', 'Billing'),
    (gen_random_uuid(), 'module.audit_trail', 'Access to system-wide audit logs and histories.', 'Security'),
    (gen_random_uuid(), 'module.roles', 'Access to roles and permissions management.', 'Security'),
    (gen_random_uuid(), 'module.leave_approvals', 'Access to leave approvals dashboard.', 'HR'),
    (gen_random_uuid(), 'module.leave_requests', 'Access to personal leave requests.', 'HR'),
    (gen_random_uuid(), 'module.teams', 'Access to organization teams management.', 'Admin')
  ON CONFLICT (code) DO NOTHING;

  -- Reload schema cache
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
