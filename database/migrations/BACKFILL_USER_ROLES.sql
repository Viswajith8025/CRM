-- ==============================================================================
-- BACKFILL USER_ROLES: Link existing users to dynamic roles
-- ==============================================================================
-- This script links existing users (who only have profiles.role set) to the
-- correct dynamic role in the user_roles table so permissions work correctly.

DO $$
DECLARE
    v_profile RECORD;
    v_role_id UUID;
    v_role_name TEXT;
BEGIN
    -- Loop through all profiles that don't yet have a user_roles assignment
    FOR v_profile IN
        SELECT p.id, p.role, p.organization_id, p.full_name
        FROM profiles p
        WHERE p.role NOT IN ('super_admin')
          AND p.organization_id IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM user_roles ur WHERE ur.user_id = p.id
          )
    LOOP
        -- Map the legacy role column to the dynamic role name
        v_role_name := CASE p.role
            WHEN 'admin'    THEN 'Administrator'
            WHEN 'manager'  THEN 'HR'
            WHEN 'employee' THEN 'Employee'
            WHEN 'client'   THEN 'Employee' -- fallback
            ELSE 'Employee'
        END;

        -- Find the matching dynamic role in the same organization
        SELECT id INTO v_role_id
        FROM roles
        WHERE name = v_role_name
          AND organization_id = v_profile.organization_id
        LIMIT 1;

        -- If the role exists, create the user_roles link
        IF v_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id)
            VALUES (v_profile.id, v_role_id)
            ON CONFLICT DO NOTHING;

            RAISE NOTICE 'Linked user % (%) → role % (%)', 
                v_profile.full_name, v_profile.id, v_role_name, v_role_id;
        ELSE
            RAISE WARNING 'No role "%" found for org % — user % skipped', 
                v_role_name, v_profile.organization_id, v_profile.full_name;
        END IF;
    END LOOP;
END;
$$;

-- Verify the result
SELECT 
    p.full_name,
    p.role AS legacy_role,
    r.name AS dynamic_role,
    COUNT(rp.permission_id) AS permission_count
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id
LEFT JOIN roles r ON r.id = ur.role_id
LEFT JOIN role_permissions rp ON rp.role_id = r.id
WHERE p.role != 'super_admin'
GROUP BY p.full_name, p.role, r.name
ORDER BY p.full_name;
