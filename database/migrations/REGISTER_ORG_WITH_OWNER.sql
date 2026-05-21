-- ==============================================================================
-- ENTERPRISE ONBOARDING ENGINE (H-4 FIX)
-- ==============================================================================
-- This RPC securely handles the entire organization + owner setup in a single
-- atomic PostgreSQL transaction. This prevents "ghost" organizations from 
-- being created if a step fails during onboarding.

CREATE OR REPLACE FUNCTION public.register_organization_with_owner(
    p_org_name TEXT,
    p_user_full_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_org_id UUID;
    v_user_id UUID;
BEGIN
    -- 1. Authenticate caller
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required to register an organization.';
    END IF;

    -- 2. Create the Organization (Atomic)
    INSERT INTO public.organization_settings (company_name)
    VALUES (p_org_name)
    RETURNING id INTO v_new_org_id;

    -- 3. Claim Ownership (Update Profile)
    -- Elevate the user to super_admin and link them to the new org.
    UPDATE public.profiles
    SET organization_id = v_new_org_id,
        role = 'super_admin',
        status = 'active',
        full_name = COALESCE(p_user_full_name, full_name)
    WHERE id = v_user_id;

    -- 4. Seed Default Departments (Optional Setup Default)
    INSERT INTO public.departments (organization_id, name, color, is_active)
    VALUES 
        (v_new_org_id, 'Executive', '#0f172a', true),
        (v_new_org_id, 'Sales', '#2563eb', true),
        (v_new_org_id, 'Engineering', '#059669', true)
    ON CONFLICT DO NOTHING;

    -- 5. Seed Default Custom Roles
    -- (If we are using dynamic RBAC, we should ensure the Admin role exists)
    INSERT INTO public.roles (organization_id, name, description, is_system)
    VALUES (v_new_org_id, 'Admin', 'Full administrative access', true)
    ON CONFLICT DO NOTHING;

    -- 6. Assign Custom Role to Owner
    INSERT INTO public.user_roles (user_id, role_id)
    SELECT v_user_id, id FROM public.roles WHERE organization_id = v_new_org_id AND name = 'Admin' LIMIT 1
    ON CONFLICT DO NOTHING;

    -- 7. Audit Log Entry
    INSERT INTO public.audit_logs (organization_id, user_id, table_name, record_id, action, new_data)
    VALUES (
        v_new_org_id, 
        v_user_id, 
        'organization_settings', 
        v_new_org_id, 
        'INSERT', 
        jsonb_build_object('company_name', p_org_name, 'event', 'ORG_CREATED')
    );

    -- Return the new organization ID on success
    RETURN v_new_org_id;

EXCEPTION WHEN OTHERS THEN
    -- Any failure in the steps above will trigger an automatic ROLLBACK of the transaction.
    RAISE;
END;
$$;

NOTIFY pgrst, 'reload schema';
