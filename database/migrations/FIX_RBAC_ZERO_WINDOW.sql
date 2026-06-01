-- ==============================================================================
-- FIX: RBAC ZERO-WINDOW VULNERABILITY
-- ==============================================================================
-- Wraps role permission updates in a single ACID transaction to prevent
-- network failures from leaving roles with zero permissions.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_role_permissions(
  p_role_id UUID,
  p_permission_ids UUID[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_org_id UUID;
BEGIN
  -- 1. Security Check: Ensure the user is authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: You must be logged in.';
  END IF;

  -- 2. Security Check: Ensure the user belongs to the same org as the role
  SELECT organization_id INTO v_user_org_id FROM public.profiles WHERE id = auth.uid();
  SELECT organization_id INTO v_org_id FROM public.roles WHERE id = p_role_id;
  
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND: Role does not exist.';
  END IF;

  IF v_org_id != v_user_org_id THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant modification denied.';
  END IF;

  -- 3. Delete existing permissions
  DELETE FROM public.role_permissions WHERE role_id = p_role_id;

  -- 4. Insert new permissions (if any)
  IF array_length(p_permission_ids, 1) > 0 THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
    SELECT p_role_id, unnest(p_permission_ids);
  END IF;
  
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_role_permissions TO authenticated;
NOTIFY pgrst, 'reload schema';
