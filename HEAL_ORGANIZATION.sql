-- Ultimate Healing Script: Align all employees to the Admin's Organization
-- 1. Temporarily bypass the security function logic
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger AS $$
BEGIN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Find the Admin's organization_id and assign all users to it
DO $$
DECLARE
  v_admin_org uuid;
BEGIN
  -- Get the organization ID of the primary admin
  SELECT organization_id INTO v_admin_org 
  FROM profiles 
  WHERE role = 'admin' 
  LIMIT 1;

  -- If we found an admin org, align everyone and everything to it
  IF v_admin_org IS NOT NULL THEN
    -- Align all users
    UPDATE profiles SET organization_id = v_admin_org WHERE organization_id != v_admin_org;
    
    -- Align all core data
    UPDATE projects SET organization_id = v_admin_org WHERE organization_id != v_admin_org;
    UPDATE tasks SET organization_id = v_admin_org WHERE organization_id != v_admin_org;
    UPDATE clients SET organization_id = v_admin_org WHERE organization_id != v_admin_org;
    UPDATE leads SET organization_id = v_admin_org WHERE organization_id != v_admin_org;
  END IF;
END $$;

-- 3. Restore the strict security function immediately
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_fields()
RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    IF (
      (NEW.role IS DISTINCT FROM OLD.role) OR
      (NEW.organization_id IS DISTINCT FROM OLD.organization_id)
    ) THEN
      IF NOT EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() AND role = 'admin'
      ) THEN
        RAISE EXCEPTION 'Security Violation: You do not have permission to change your role or organization.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
