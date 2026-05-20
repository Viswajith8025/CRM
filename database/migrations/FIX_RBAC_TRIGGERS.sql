-- ==============================================================================
-- FIX RBAC TRIGGERS (Name Collision Resolution)
-- Run this in your Supabase SQL Editor
-- ==============================================================================

-- 1. Restore the correct log_permission_change() function for the PROFILES table
-- This restores the function from AUDIT_TRAIL_SCHEMA that was accidentally overwritten
CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activities (
      user_id, action, target_type, target_id, target_name,
      metadata, severity, is_system, organization_id
    ) VALUES (
      auth.uid(),
      CASE 
        WHEN OLD.role IS DISTINCT FROM NEW.role THEN 'PERMISSION_CHANGE'
        WHEN NEW.status = 'denied' THEN 'ACCESS_REVOKED'
        WHEN NEW.status = 'active' AND OLD.status = 'pending' THEN 'ACCESS_GRANTED'
        ELSE 'STATUS_CHANGE'
      END,
      'user',
      NEW.id::text,
      coalesce(NEW.full_name, NEW.email, NEW.id::text),
      jsonb_build_object(
        'description', CASE
          WHEN OLD.role IS DISTINCT FROM NEW.role 
            THEN format('User role changed from "%s" to "%s"', OLD.role, NEW.role)
          WHEN NEW.status = 'denied'
            THEN format('Access revoked for "%s"', coalesce(NEW.full_name, NEW.email))
          WHEN NEW.status = 'active' AND OLD.status = 'pending'
            THEN format('Access approved for "%s"', coalesce(NEW.full_name, NEW.email))
          ELSE format('User status changed from "%s" to "%s"', OLD.status, NEW.status)
        END,
        'previous_role', OLD.role,
        'new_role', NEW.role,
        'previous_status', OLD.status,
        'new_status', NEW.status,
        'target_email', NEW.email
      ),
      CASE 
        WHEN OLD.role IS DISTINCT FROM NEW.role OR NEW.status = 'denied' THEN 'critical'
        ELSE 'info'
      END,
      false,
      NEW.organization_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Create the uniquely named log_role_permission_change() for ROLE_PERMISSIONS
CREATE OR REPLACE FUNCTION public.log_role_permission_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.permission_audit_logs 
    (actor_id, target_role, action, permission, metadata)
  VALUES (
    auth.uid(),
    COALESCE(NEW.role_id, OLD.role_id)::text,
    TG_OP,
    (SELECT code FROM public.permissions WHERE id = COALESCE(NEW.permission_id, OLD.permission_id)),
    jsonb_build_object('table', TG_TABLE_NAME, 'timestamp', now())
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Update the role_permissions trigger to point to the new unique function
DROP TRIGGER IF EXISTS trg_audit_role_permissions ON public.role_permissions;

CREATE TRIGGER trg_audit_role_permissions
  AFTER INSERT OR DELETE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.log_role_permission_change();

-- Done! This will fix the 'record "new" has no field "role_id"' error.
