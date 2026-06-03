-- ==============================================================================
-- FIX HIGH-2: AUTH HYDRATION OPTIMIZATION
-- ==============================================================================
-- This RPC collapses 4 sequential network calls into a single database round-trip.
-- It fetches the profile, dynamic role, organization status, and permission codes
-- in one go, dramatically improving the application's perceived cold-load time.

CREATE OR REPLACE FUNCTION public.bootstrap_user_session(p_user_id UUID)
RETURNS JSON AS $$
DECLARE
    v_profile RECORD;
    v_role_name TEXT;
    v_org_status TEXT := 'active';
    v_permissions TEXT[];
BEGIN
    -- 1. Fetch Profile
    SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Profile not found');
    END IF;

    -- 2. Resolve Dynamic Role Name
    SELECT roles.name INTO v_role_name
    FROM public.user_roles
    JOIN public.roles ON user_roles.role_id = roles.id
    WHERE user_roles.user_id = p_user_id
    LIMIT 1;

    -- 3. Check Org Status (skip if super_admin or no org)
    IF v_profile.role != 'super_admin' AND v_profile.organization_id IS NOT NULL THEN
        SELECT status INTO v_org_status 
        FROM public.organization_settings 
        WHERE id = v_profile.organization_id;
    END IF;

    -- 4. Resolve Permissions
    -- We can use the existing get_user_permission_codes_v2 if it exists, 
    -- but doing it inline is safer and just as fast.
    SELECT array_agg(DISTINCT p.code) INTO v_permissions
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role_id = rp.role_id
    JOIN public.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id;

    -- Return everything as a single JSON object
    RETURN json_build_object(
        'profile', row_to_json(v_profile),
        'dynamic_role', v_role_name,
        'is_org_suspended', (v_org_status = 'suspended'),
        'permissions', COALESCE(v_permissions, ARRAY[]::TEXT[])
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
