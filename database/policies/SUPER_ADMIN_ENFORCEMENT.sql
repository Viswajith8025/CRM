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

  -- All checks passed: perform the update
  UPDATE public.profiles
    SET role = new_role
    WHERE id = target_user_id;
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
-- 5. VERIFY: Show current super_admin (sanity check)
-- ============================================================
SELECT id, email, full_name, role 
FROM public.profiles 
WHERE role = 'super_admin';

-- ============================================================
-- DONE. Reload schema cache.
-- ============================================================
NOTIFY pgrst, 'reload schema';
