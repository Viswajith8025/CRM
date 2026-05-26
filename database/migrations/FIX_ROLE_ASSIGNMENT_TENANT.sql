-- ==============================================================================
-- FIX: assign_user_role Cross-Tenant Block for Pending Users
-- Automatically assigns the super admin's organization_id to the target user
-- if the target user doesn't have an organization_id yet.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.assign_user_role(
    p_user_id UUID,
    p_role_id UUID,
    p_assigned_by UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_name TEXT;
    v_profile_role TEXT;
    v_org_id UUID;
    v_admin_role TEXT;
BEGIN
    -- 1. Get target user's current organization
    SELECT organization_id INTO v_org_id
    FROM profiles WHERE id = p_user_id;

    -- 2. If target user has no organization (newly registered), auto-assign them to the admin's org
    IF v_org_id IS NULL THEN
        SELECT organization_id, role INTO v_org_id, v_admin_role FROM profiles WHERE id = p_assigned_by;
        
        -- Only super admins or admins can adopt new users
        IF v_admin_role IN ('super_admin', 'admin') THEN
            UPDATE profiles SET organization_id = v_org_id WHERE id = p_user_id;
        ELSE
            RAISE EXCEPTION 'Only administrators can assign roles to new users.';
        END IF;
    END IF;

    -- 3. Validate: assigned_by user must be in the same org as target
    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = p_assigned_by 
          AND organization_id = v_org_id
    ) THEN
        RAISE EXCEPTION 'Cross-tenant role assignment blocked.';
    END IF;

    -- 4. Validate: role must belong to the same org
    SELECT name INTO v_role_name
    FROM roles
    WHERE id = p_role_id AND organization_id = v_org_id;

    IF v_role_name IS NULL THEN
        RAISE EXCEPTION 'Role not found in this organization.';
    END IF;

    -- 5. Remove existing role assignments for this user
    DELETE FROM user_roles WHERE user_id = p_user_id;

    -- 6. Insert new role assignment
    INSERT INTO user_roles (user_id, role_id)
    VALUES (p_user_id, p_role_id);

    -- 7. Backward compatibility for profiles.role
    v_profile_role := CASE LOWER(v_role_name)
        WHEN 'administrator' THEN 'admin'
        WHEN 'hr' THEN 'manager'
        WHEN 'employee' THEN 'employee'
        ELSE 'employee'
    END;

    UPDATE profiles 
    SET role = v_profile_role::user_role, updated_at = NOW()
    WHERE id = p_user_id;

    -- 8. Log the action
    INSERT INTO activities (user_id, organization_id, action, target_type, target_id, target_name, severity, metadata)
    VALUES (
        p_assigned_by,
        v_org_id,
        'ROLE_ASSIGNED',
        'profile',
        p_user_id,
        (SELECT full_name FROM profiles WHERE id = p_user_id),
        'info',
        jsonb_build_object('role_name', v_role_name, 'role_id', p_role_id)
    );
END;
$$;

NOTIFY pgrst, 'reload schema';
