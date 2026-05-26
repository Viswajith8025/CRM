-- ==============================================================================
-- ADD CLIENT STATEMENTS TO PERMISSIONS CATALOG
-- ==============================================================================

DO $$ 
DECLARE
  v_module_id UUID;
BEGIN
  -- Insert the module permission for Client Statements
  INSERT INTO public.permissions (id, code, description, module)
  VALUES (
    gen_random_uuid(),
    'module.statements',
    'Access to client statements and ledger views.',
    'Billing'
  )
  ON CONFLICT (code) DO NOTHING;

  -- Ensure it's assigned to admin/super_admin by default if needed
  -- (Super admin already bypasses, but admin might need explicit mapping)
  
  -- Reload schema cache
  PERFORM pg_notify('pgrst', 'reload schema');
END $$;
