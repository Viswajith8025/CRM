-- ==============================================================================
-- GRANULAR PERMISSIONS & RBAC SYSTEM
-- Replaces role-only checks with a permission matrix
-- ==============================================================================

-- 1. PERMISSIONS DEFINITION
CREATE TABLE IF NOT EXISTS public.rbac_permissions (
  id TEXT PRIMARY KEY, -- e.g., 'invoices.edit', 'projects.delete'
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL -- 'billing', 'crm', 'projects', 'hr', 'system'
);

-- 2. ROLE-PERMISSION MAPPING
CREATE TABLE IF NOT EXISTS public.rbac_role_permissions (
  role TEXT NOT NULL, -- 'super_admin', 'admin', 'manager', 'employee', 'client'
  permission_id TEXT REFERENCES public.rbac_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role, permission_id)
);

-- 3. USER-SPECIFIC PERMISSION OVERRIDES (Optional but powerful)
CREATE TABLE IF NOT EXISTS public.rbac_user_permissions (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  permission_id TEXT REFERENCES public.rbac_permissions(id) ON DELETE CASCADE,
  is_allowed BOOLEAN DEFAULT true, -- Allows both granting and explicitly denying
  PRIMARY KEY (user_id, permission_id)
);

-- 4. SEED INITIAL PERMISSIONS
INSERT INTO public.rbac_permissions (id, name, description, category) VALUES
  ('invoices.view', 'View Invoices', 'Can view billing records', 'billing'),
  ('invoices.edit', 'Edit Invoices', 'Can create and update invoices', 'billing'),
  ('invoices.delete', 'Delete Invoices', 'Can delete invoice records', 'billing'),
  ('projects.view', 'View Projects', 'Can view project details', 'projects'),
  ('projects.edit', 'Edit Projects', 'Can update project details', 'projects'),
  ('projects.delete', 'Delete Projects', 'Can delete projects', 'projects'),
  ('crm.leads.view', 'View Leads', 'Can see sales pipeline', 'crm'),
  ('crm.leads.delete', 'Delete Leads', 'Can remove lead records', 'crm'),
  ('hr.view', 'View HR', 'Can see payroll and employee files', 'hr'),
  ('system.settings', 'Manage Settings', 'Can change organization settings', 'system')
ON CONFLICT (id) DO NOTHING;

-- 5. SEED ROLE MAPPINGS
INSERT INTO public.rbac_role_permissions (role, permission_id) VALUES
  -- Managers
  ('manager', 'invoices.view'),
  ('manager', 'invoices.edit'),
  ('manager', 'projects.view'),
  ('manager', 'projects.edit'),
  ('manager', 'crm.leads.view'),
  -- Employees
  ('employee', 'projects.view'),
  ('employee', 'projects.edit')
ON CONFLICT DO NOTHING;

-- 6. AGGREGATE FUNCTION: Get user's effective permissions
DROP FUNCTION IF EXISTS public.get_user_permissions(UUID);
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS TEXT[] 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_perms TEXT[];
BEGIN
    -- Get user's role
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;

    -- Combine role-based permissions and user overrides
    SELECT ARRAY_AGG(DISTINCT perm_id) INTO v_perms
    FROM (
        -- Permissions from role
        SELECT permission_id as perm_id 
        FROM public.rbac_role_permissions 
        WHERE role = v_role
        
        UNION
        
        -- Explicitly granted user permissions
        SELECT permission_id 
        FROM public.rbac_user_permissions 
        WHERE user_id = p_user_id AND is_allowed = true
        
        EXCEPT
        
        -- Explicitly denied user permissions
        SELECT permission_id 
        FROM public.rbac_user_permissions 
        WHERE user_id = p_user_id AND is_allowed = false
    ) combined;

    -- Super Admin gets everything
    IF v_role = 'super_admin' THEN
        SELECT ARRAY_AGG(id) INTO v_perms FROM public.rbac_permissions;
    END IF;

    RETURN COALESCE(v_perms, ARRAY[]::TEXT[]);
END;
$$;

-- 7. RLS HELPER: check_permission
DROP FUNCTION IF EXISTS public.has_permission(TEXT);
CREATE OR REPLACE FUNCTION public.has_permission(p_perm TEXT)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN p_perm = ANY(public.get_user_permissions(auth.uid()));
END;
$$;

-- 8. EXAMPLE: Update Invoice RLS to use permissions
DROP POLICY IF EXISTS "invoice_edit_permission" ON public.invoices;
CREATE POLICY "invoice_edit_permission" ON public.invoices
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_my_org_id() AND public.has_permission('invoices.edit'));

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT) TO authenticated;

-- ==============================================================================
-- DONE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
