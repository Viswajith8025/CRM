-- ==============================================================================
-- ENTERPRISE AUDIT TRAIL SCHEMA
-- Complete immutable audit logging for multi-tenant CRM
-- Run in Supabase SQL Editor
-- ==============================================================================

-- ============================================================
-- 1. EXTEND activities TABLE with enterprise-grade columns
-- ============================================================
-- Add missing columns if they don't exist
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS severity       TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  ADD COLUMN IF NOT EXISTS ip_address     TEXT,
  ADD COLUMN IF NOT EXISTS user_agent     TEXT,
  ADD COLUMN IF NOT EXISTS session_id     TEXT,
  ADD COLUMN IF NOT EXISTS is_system      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checksum       TEXT GENERATED ALWAYS AS (
    md5(coalesce(user_id::text,'') || action || target_type || target_id)
  ) STORED;

-- ============================================================
-- 2. MAKE AUDIT LOGS IMMUTABLE
-- No UPDATE or DELETE allowed on activities — ever.
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'IMMUTABLE: Audit log records cannot be modified or deleted. Record ID: %', OLD.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_audit_immutability ON public.activities;
CREATE TRIGGER enforce_audit_immutability
  BEFORE UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_modification();

-- ============================================================
-- 3. PERFORMANCE: Targeted indexes for fast filtered queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_activities_org_created    ON public.activities (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_user_created   ON public.activities (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_action         ON public.activities (action);
CREATE INDEX IF NOT EXISTS idx_activities_target_type    ON public.activities (target_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_severity       ON public.activities (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_target_id      ON public.activities (target_id);

-- ============================================================
-- 4. AUTO-LOG: Organization suspension via DB trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_org_suspension()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activities (
      user_id, action, target_type, target_id, target_name,
      metadata, severity, is_system, organization_id
    ) VALUES (
      auth.uid(),
      CASE WHEN NEW.status = 'suspended' THEN 'ORG_SUSPENDED' ELSE 'ORG_REACTIVATED' END,
      'organization',
      NEW.id::text,
      NEW.company_name,
      jsonb_build_object(
        'description', CASE 
          WHEN NEW.status = 'suspended' THEN format('Organization "%s" was suspended', NEW.company_name)
          ELSE format('Organization "%s" was reactivated', NEW.company_name)
        END,
        'previous_value', OLD.status,
        'new_value', NEW.status,
        'suspended_at', NEW.suspended_at
      ),
      CASE WHEN NEW.status = 'suspended' THEN 'critical' ELSE 'warning' END,
      false,
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_org_status_change ON public.organization_settings;
CREATE TRIGGER on_org_status_change
  AFTER UPDATE OF status ON public.organization_settings
  FOR EACH ROW EXECUTE FUNCTION public.log_org_suspension();

-- ============================================================
-- 5. AUTO-LOG: Payment status changes via DB trigger
-- ============================================================
-- Ensure status column exists (also defined in BILLING_ENTERPRISE_UPGRADE.sql)
ALTER TABLE public.payments 
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'verified';

CREATE OR REPLACE FUNCTION public.log_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.activities (
      user_id, action, target_type, target_id, target_name,
      metadata, severity, is_system, organization_id
    ) VALUES (
      auth.uid(),
      'PAYMENT_STATUS_CHANGE',
      'payment',
      NEW.id::text,
      coalesce(NEW.reference_number, 'Payment #' || NEW.id),
      jsonb_build_object(
        'description', format('Payment status changed from "%s" to "%s"', OLD.status, NEW.status),
        'previous_value', OLD.status,
        'new_value', NEW.status,
        'amount', NEW.amount,
        'invoice_id', NEW.invoice_id
      ),
      CASE WHEN NEW.status = 'failed' THEN 'warning' ELSE 'info' END,
      false,
      NEW.organization_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_status_change ON public.payments;
CREATE TRIGGER on_payment_status_change
  AFTER UPDATE OF status ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_payment_status_change();

-- ============================================================
-- 6. AUTO-LOG: Proposal approval/rejection via DB trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_proposal_decision()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status 
     AND NEW.status IN ('approved', 'rejected', 'sent') THEN
    INSERT INTO public.activities (
      user_id, action, target_type, target_id, target_name,
      metadata, severity, is_system, organization_id
    ) VALUES (
      auth.uid(),
      CASE NEW.status
        WHEN 'approved' THEN 'PROPOSAL_APPROVED'
        WHEN 'rejected' THEN 'PROPOSAL_REJECTED'
        WHEN 'sent'     THEN 'PROPOSAL_SENT'
        ELSE 'STATUS_CHANGE'
      END,
      'proposal',
      NEW.id::text,
      coalesce(NEW.title, 'Proposal #' || NEW.id),
      jsonb_build_object(
        'description', format('Proposal "%s" was %s', coalesce(NEW.title, NEW.id::text), NEW.status),
        'previous_value', OLD.status,
        'new_value', NEW.status,
        'client_id', NEW.client_id,
        'total_value', NEW.total_value
      ),
      CASE NEW.status WHEN 'rejected' THEN 'warning' ELSE 'info' END,
      false,
      NEW.organization_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_proposal_decision ON public.proposals;
CREATE TRIGGER on_proposal_decision
  AFTER UPDATE OF status ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.log_proposal_decision();

-- ============================================================
-- 7. AUTO-LOG: Permission / role changes
-- ============================================================
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

DROP TRIGGER IF EXISTS on_permission_change ON public.profiles;
CREATE TRIGGER on_permission_change
  AFTER UPDATE OF role, status ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.log_permission_change();

-- ============================================================
-- 8. RLS: Audit logs are org-scoped, super_admin sees all
-- ============================================================
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_select" ON public.activities;
CREATE POLICY "activities_select" ON public.activities
  FOR SELECT TO authenticated
  USING (
    (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'super_admin'
    OR organization_id = public.get_my_org_id()
  );

DROP POLICY IF EXISTS "activities_insert" ON public.activities;
CREATE POLICY "activities_insert" ON public.activities
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_my_org_id()
    OR (current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'role') = 'super_admin'
    OR is_system = true
  );

-- No UPDATE or DELETE policies — handled by the immutability trigger above.

-- ============================================================
-- 9. HELPER FUNCTION: Paginated audit fetch with filters
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_audit_trail(
  p_org_id        UUID DEFAULT NULL,
  p_user_id       UUID DEFAULT NULL,
  p_action        TEXT DEFAULT NULL,
  p_target_type   TEXT DEFAULT NULL,
  p_severity      TEXT DEFAULT NULL,
  p_from_date     TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_to_date       TIMESTAMPTZ DEFAULT NOW(),
  p_limit         INT DEFAULT 50,
  p_offset        INT DEFAULT 0
)
RETURNS TABLE (
  id            UUID,
  user_id       UUID,
  action        TEXT,
  target_type   TEXT,
  target_id     TEXT,
  target_name   TEXT,
  metadata      JSONB,
  severity      TEXT,
  is_system     BOOLEAN,
  organization_id UUID,
  created_at    TIMESTAMPTZ,
  checksum      TEXT,
  full_name     TEXT,
  avatar_url    TEXT,
  total_count   BIGINT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
  caller_org  UUID;
BEGIN
  SELECT role, organization_id INTO caller_role, caller_org FROM public.profiles WHERE id = auth.uid();

  RETURN QUERY
  WITH filtered AS (
    SELECT a.*, COUNT(*) OVER() AS total_count
    FROM public.activities a
    WHERE
      -- Org scoping: super_admin sees all, others see own org
      (caller_role = 'super_admin' OR a.organization_id = caller_org)
      AND (p_org_id IS NULL OR a.organization_id = p_org_id)
      AND (p_user_id IS NULL OR a.user_id = p_user_id)
      AND (p_action IS NULL OR a.action = p_action)
      AND (p_target_type IS NULL OR a.target_type = p_target_type)
      AND (p_severity IS NULL OR a.severity = p_severity)
      AND a.created_at BETWEEN p_from_date AND p_to_date
    ORDER BY a.created_at DESC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    f.id, f.user_id, f.action, f.target_type, f.target_id, f.target_name,
    f.metadata, f.severity, f.is_system, f.organization_id, f.created_at, f.checksum,
    p.full_name, p.avatar_url,
    f.total_count
  FROM filtered f
  LEFT JOIN public.profiles p ON p.id = f.user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_audit_trail(UUID,UUID,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,INT,INT) TO authenticated;

-- ============================================================
-- DONE
-- ============================================================
NOTIFY pgrst, 'reload schema';
