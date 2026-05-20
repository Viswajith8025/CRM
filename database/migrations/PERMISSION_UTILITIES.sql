-- ==============================================================================
-- DYNAMIC PERMISSION UTILITIES
-- ==============================================================================
-- Functions to help resolve users based on dynamic permissions.

CREATE OR REPLACE FUNCTION public.get_users_with_permission(p_permission_code TEXT)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ur.user_id
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE p.code = p_permission_code;
END;
$$;

NOTIFY pgrst, 'reload schema';
