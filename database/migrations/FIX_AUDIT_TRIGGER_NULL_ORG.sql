-- ==============================================================================
-- FIX: Audit Trail Trigger Null Organization Error
-- When a super admin approves a pending user, the user might not have an
-- organization_id yet. The audit trigger was failing because activities
-- requires a non-null organization_id.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.log_permission_change()
RETURNS TRIGGER AS $$
DECLARE
  v_caller_org UUID;
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- If the user being modified has no organization, fallback to the admin's organization
    -- so the audit log has a valid organization_id
    IF NEW.organization_id IS NULL THEN
      SELECT organization_id INTO v_caller_org FROM public.profiles WHERE id = auth.uid();
    END IF;

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
      COALESCE(NEW.organization_id, v_caller_org)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
