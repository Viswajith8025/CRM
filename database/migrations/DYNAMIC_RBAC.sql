-- ==============================================================================
-- DYNAMIC RBAC: Fully Dynamic Role Assignment
-- ==============================================================================
-- Replaces the static profiles.role column with the dynamic user_roles system.
-- When a Super Admin assigns a role, it updates both user_roles AND profiles.role 
-- for backward compatibility.

-- 1. Atomic Role Assignment RPC
-- Assigns a user to a dynamic role. Removes their previous role assignment first.
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
BEGIN
    -- 1. Validate: assigned_by user must be in the same org as target
    SELECT organization_id INTO v_org_id
    FROM profiles WHERE id = p_user_id;

    IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = p_assigned_by 
          AND organization_id = v_org_id
    ) THEN
        RAISE EXCEPTION 'Cross-tenant role assignment blocked.';
    END IF;

    -- 2. Validate: role must belong to the same org
    SELECT name INTO v_role_name
    FROM roles
    WHERE id = p_role_id AND organization_id = v_org_id;

    IF v_role_name IS NULL THEN
        RAISE EXCEPTION 'Role not found in this organization.';
    END IF;

    -- 3. Remove existing role assignments for this user (one role at a time model)
    DELETE FROM user_roles WHERE user_id = p_user_id;

    -- 4. Insert new role assignment
    INSERT INTO user_roles (user_id, role_id)
    VALUES (p_user_id, p_role_id);

    -- 5. Backward compatibility: map role name to profiles.role column
    -- This keeps the old system working during migration.
    v_profile_role := CASE LOWER(v_role_name)
        WHEN 'administrator' THEN 'admin'
        WHEN 'hr' THEN 'manager'
        WHEN 'employee' THEN 'employee'
        ELSE 'employee' -- Custom roles default to employee-level profile role
    END;

    UPDATE profiles 
    SET role = v_profile_role::user_role, updated_at = NOW()
    WHERE id = p_user_id;

    -- 6. Log the action
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

-- 2. Get user's current dynamic role (for display in team list)
CREATE OR REPLACE FUNCTION public.get_user_dynamic_role(p_user_id UUID)
RETURNS TABLE (role_id UUID, role_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT r.id::UUID, r.name::TEXT
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
    LIMIT 1;
END;
$$;

-- 3. Clean up any auto-created "Finance" and "Project Manager" roles
-- that were never requested by the user
DELETE FROM roles WHERE name IN ('Finance', 'Project Manager') AND is_system = true;

NOTIFY pgrst, 'reload schema';
