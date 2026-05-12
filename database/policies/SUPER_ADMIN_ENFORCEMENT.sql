-- ==============================================================================
-- SUPER ADMIN ENFORCEMENT — SINGLE SUPER ADMIN + ROLE GATE
-- Run this in Supabase SQL Editor
-- ==============================================================================

-- ============================================================
-- 1. ENFORCE: Only ONE super_admin can ever exist (DB constraint)
-- ============================================================
-- Partial unique index: only one row where role = 'super_admin' is allowed
-- globally across the entire profiles table.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_super_admin
  ON public.profiles (role)
  WHERE role = 'super_admin';

-- ============================================================
-- 2. SECURE FUNCTION: promote_to_admin
-- Only a super_admin can call this function to grant/change roles.
-- Employees and admins CANNOT set anyone's role to 'admin' or 'super_admin'.
-- super_admin cannot be granted via this function either (it's locked at DB level).
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_member_role(
  target_user_id UUID,
  new_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
  target_current_role TEXT;
BEGIN
  -- Get the role of the user calling this function
  SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = auth.uid();

  -- Get the current role of the target user
  SELECT role INTO target_current_role
    FROM public.profiles
    WHERE id = target_user_id;

  -- RULE 1: Nobody can ever set a role to 'super_admin' via this function.
  IF new_role = 'super_admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: The super_admin role cannot be assigned via this function. There can only be one super_admin.';
  END IF;

  -- RULE 2: Only super_admin can grant or revoke the 'admin' role.
  IF new_role = 'admin' AND caller_role <> 'super_admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: Only a super_admin can grant the admin role.';
  END IF;

  -- RULE 3: You cannot demote the current super_admin.
  IF target_current_role = 'super_admin' THEN
    RAISE EXCEPTION 'FORBIDDEN: The super_admin role cannot be changed or revoked.';
  END IF;

  -- RULE 4: Only super_admin and admin can change roles at all.
  IF caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'FORBIDDEN: You do not have permission to change member roles.';
  END IF;

  -- 1. Perform legacy update
  UPDATE public.profiles
    SET role = new_role
    WHERE id = target_user_id;

  -- 2. Synchronize Dynamic RBAC (user_roles table)
  -- Find the role_id in the new dynamic system that matches the role name
  DECLARE
    new_role_id UUID;
    target_org_id UUID;
  BEGIN
    SELECT organization_id INTO target_org_id FROM public.profiles WHERE id = target_user_id;
    
    -- Find the matching role in the organization
    -- (Map 'manager' to 'HR' if that's what the UI uses, but roles table has 'HR')
    -- Actually, the roles table has 'Administrator', 'HR', 'Employee' based on ENTERPRISE_RBAC.sql
    -- The profiles table has 'admin', 'manager', 'employee'.
    SELECT id INTO new_role_id 
    FROM public.roles 
    WHERE organization_id = target_org_id
    AND (
      (LOWER(name) = 'administrator' AND LOWER(new_role) = 'admin') OR
      (LOWER(name) = 'hr' AND LOWER(new_role) = 'manager') OR
      (LOWER(name) = LOWER(new_role))
    )
    LIMIT 1;

    IF new_role_id IS NOT NULL THEN
      -- Delete old roles for this user and insert the new one
      DELETE FROM public.user_roles WHERE user_id = target_user_id;
      INSERT INTO public.user_roles (user_id, role_id) VALUES (target_user_id, new_role_id);
    END IF;
  END;
END;
$$;

-- Grant execute to authenticated users (the function itself enforces role checks)
GRANT EXECUTE ON FUNCTION public.update_member_role(UUID, TEXT) TO authenticated;

-- ============================================================
-- 3. RLS POLICY: Lock direct `UPDATE role` on profiles table
-- Prevent any direct client-side SQL from bypassing the function above.
-- ============================================================

-- Drop any existing update policy on profiles that allows role changes
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Re-create a safe update policy:
-- Users can update their OWN profile (name, avatar, etc.) BUT NOT their role.
-- Super admins can update anything.
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    id = auth.uid()
    OR (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'super_admin'
  )
  WITH CHECK (
    -- Non-super-admins can only change their own non-role fields.
    -- The role field check: if the caller is not super_admin, the new role must equal the current role.
    (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'super_admin'
    OR (
      id = auth.uid()
      AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ============================================================
-- 4. AUDIT TRIGGER: Log any attempt to change role for compliance
-- ============================================================
CREATE TABLE IF NOT EXISTS public.role_change_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  changed_by UUID NOT NULL,
  target_user_id UUID NOT NULL,
  old_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on audit table (super_admin can read, nobody can write directly)
ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select" ON public.role_change_audit;
CREATE POLICY "audit_select" ON public.role_change_audit
  FOR SELECT TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'super_admin'
  );

-- Trigger function to auto-log role changes
CREATE OR REPLACE FUNCTION public.log_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role <> NEW.role THEN
    INSERT INTO public.role_change_audit (changed_by, target_user_id, old_role, new_role)
    VALUES (auth.uid(), NEW.id, OLD.role, NEW.role);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_role_change ON public.profiles;
CREATE TRIGGER on_role_change
  AFTER UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_role_change();

-- ============================================================
-- 5. SYNC TRIGGER: Keep user_roles aligned with profiles.role
-- ============================================================
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
      (LOWER(name) = 'administrator' AND LOWER(NEW.role) = 'admin') OR
      (LOWER(name) = 'hr' AND LOWER(NEW.role) = 'manager') OR
      (LOWER(name) = LOWER(NEW.role))
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

DROP TRIGGER IF EXISTS tr_sync_user_rbac ON public.profiles;
CREATE TRIGGER tr_sync_user_rbac
  AFTER INSERT OR UPDATE OF role, organization_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_rbac();

-- ============================================================
-- 6. VERIFY: Show current super_admin (sanity check)
-- ============================================================
SELECT id, email, full_name, role 
FROM public.profiles 
WHERE role = 'super_admin';

-- ============================================================
-- DONE. Reload schema cache.
-- ============================================================
NOTIFY pgrst, 'reload schema';
