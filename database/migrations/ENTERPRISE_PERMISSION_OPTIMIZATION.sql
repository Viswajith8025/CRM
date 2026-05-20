-- ==============================================================================
-- ENTERPRISE PERMISSION OPTIMIZATION
-- ==============================================================================
-- This script provides a high-performance RPC to fetch all user permissions
-- in a single call, eliminating N+1 query patterns in the frontend.

-- 1. Optimized Permission Resolver
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE (permission_code TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_role TEXT;
BEGIN
    -- 1. Get legacy role for super_admin bypass
    SELECT role INTO v_user_role FROM public.profiles WHERE id = auth.uid();
    
    -- 2. Return all if super_admin
    IF v_user_role = 'super_admin' THEN
        RETURN QUERY SELECT code FROM public.permissions;
        RETURN;
    END IF;

    -- 3. Return assigned dynamic permissions
    RETURN QUERY
    SELECT DISTINCT p.code
    FROM public.permissions p
    JOIN public.role_permissions rp ON p.id = rp.permission_id
    JOIN public.user_roles ur ON rp.role_id = ur.role_id
    WHERE ur.user_id = auth.uid();
END;
$$;

-- 2. Performance Indexes for RBAC
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role_id);

-- 3. Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- 4. Force API schema cache refresh
NOTIFY pgrst, 'reload schema';
