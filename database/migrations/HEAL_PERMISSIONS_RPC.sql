-- ==============================================================================
-- HEAL PERMISSIONS: Resolve 406 Errors in Frontend
-- ==============================================================================
-- This script creates a secure RPC to fetch all permission codes for a user.
-- This bypasses complex Supabase 'select' strings which are prone to 406 errors.

CREATE OR REPLACE FUNCTION public.get_user_permission_codes(p_user_id UUID)
RETURNS TABLE (permission_code TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Security Check: Only the user themselves or a Super Admin can fetch these
    IF (auth.uid() != p_user_id) AND NOT EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'
    ) THEN
        RAISE EXCEPTION 'UNAUTHORIZED: You can only fetch your own permissions.';
    END IF;

    RETURN QUERY
    SELECT DISTINCT p.code
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id;
END;
$$;

-- Also create a version that falls back to legacy roles if user_roles is empty
CREATE OR REPLACE FUNCTION public.get_user_permission_codes_v2(p_user_id UUID)
RETURNS TABLE (permission_code TEXT) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_legacy_role TEXT;
    v_org_id UUID;
    v_role_name TEXT;
    v_count INT;
BEGIN
    -- 1. Try dynamic RBAC first
    RETURN QUERY
    SELECT DISTINCT p.code
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id;

    -- Check if any rows were returned
    GET DIAGNOSTICS v_count = ROW_COUNT;

    -- 2. Fallback if no permissions found yet
    IF v_count = 0 THEN
        SELECT role, organization_id INTO v_legacy_role, v_org_id 
        FROM profiles WHERE id = p_user_id;

        IF v_legacy_role IS NOT NULL AND v_legacy_role != 'super_admin' THEN
            v_role_name := CASE v_legacy_role
                WHEN 'admin'    THEN 'Administrator'
                WHEN 'manager'  THEN 'HR'
                WHEN 'employee' THEN 'Employee'
                ELSE 'Employee'
            END;

            RETURN QUERY
            SELECT DISTINCT p.code
            FROM public.roles r
            JOIN public.role_permissions rp ON r.id = rp.role_id
            JOIN public.permissions p ON rp.permission_id = p.id
            WHERE r.name = v_role_name
              AND r.organization_id = v_org_id;
        END IF;
    END IF;
END;
$$;
