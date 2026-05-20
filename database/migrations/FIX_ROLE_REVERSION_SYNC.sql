-- ==============================================================================
-- FIX CUSTOM ROLE REVERSION (SYNC LOOP PREVENTION)
-- Run this in your Supabase SQL Editor to prevent custom roles (e.g. Team Lead)
-- from being forcefully reverted to standard 'Employee' during sync.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_rbac()
RETURNS TRIGGER AS $$
DECLARE
    matching_role_id UUID;
    v_current_dynamic_role_name TEXT;
BEGIN
    -- 1. Check if the user already has a dynamic role that maps to the target legacy role
    SELECT r.name INTO v_current_dynamic_role_name
    FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = NEW.id
    LIMIT 1;

    IF v_current_dynamic_role_name IS NOT NULL THEN
      IF NEW.role::text = 'admin' AND LOWER(v_current_dynamic_role_name) = 'administrator' THEN
        RETURN NEW; -- Already correctly mapped to Admin
      ELSIF NEW.role::text = 'manager' AND LOWER(v_current_dynamic_role_name) = 'hr' THEN
        RETURN NEW; -- Already correctly mapped to HR
      ELSIF NEW.role::text = 'employee' AND LOWER(v_current_dynamic_role_name) NOT IN ('administrator', 'hr') THEN
        RETURN NEW; -- Already correctly mapped to Employee or a custom role (e.g. Team Lead)
      END IF;
    END IF;

    -- 2. Find the role in the dynamic RBAC system that matches the legacy role field
    SELECT id INTO matching_role_id 
    FROM public.roles 
    WHERE organization_id = NEW.organization_id
    AND (
      (LOWER(name) = 'administrator' AND LOWER(NEW.role::text) = 'admin') OR
      (LOWER(name) = 'hr' AND LOWER(NEW.role::text) = 'manager') OR
      (LOWER(name) = LOWER(NEW.role::text))
    )
    LIMIT 1;

    IF matching_role_id IS NOT NULL THEN
      -- Synchronize the user_roles table
      DELETE FROM public.user_roles WHERE user_id = NEW.id;
      INSERT INTO public.user_roles (user_id, role_id) VALUES (NEW.id, matching_role_id);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
