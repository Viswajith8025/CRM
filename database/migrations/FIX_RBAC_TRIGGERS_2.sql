-- ==============================================================================
-- FIX LOWER(USER_ROLE) BUG IN SYNC TRIGGER
-- Run this in your Supabase SQL Editor
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_rbac()
RETURNS TRIGGER AS $$
DECLARE
    matching_role_id UUID;
BEGIN
    -- Find the role in the dynamic RBAC system that matches the legacy role field
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
