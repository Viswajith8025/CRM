-- ==============================================================================
-- ENTERPRISE WORKFLOW AUTOMATION ENGINE
-- Handles rule-based triggers, cross-module actions, and audit logging
-- ==============================================================================

-- 1. WORKFLOW RULES TABLE
CREATE TABLE IF NOT EXISTS public.workflow_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL, -- 'proposal_approved', 'payment_received', 'project_delayed', 'client_created'
  action_type TEXT NOT NULL,   -- 'create_invoice', 'activate_client', 'notify_manager', 'create_project'
  configuration JSONB DEFAULT '{}', -- Store template IDs, relative dates, etc.
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. WORKFLOW EXECUTION LOGS (Audit & Retry)
CREATE TABLE IF NOT EXISTS public.workflow_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.workflow_rules(id) ON DELETE SET NULL,
  organization_id UUID NOT NULL,
  trigger_entity_id UUID, -- The ID of the lead/project/invoice that triggered it
  status TEXT NOT NULL,    -- 'success', 'failed', 'retrying'
  error_message TEXT,
  execution_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workflow_rules_isolation" ON public.workflow_rules
  FOR ALL TO authenticated USING (organization_id = public.get_my_org_id());

CREATE POLICY "workflow_logs_isolation" ON public.workflow_logs
  FOR ALL TO authenticated USING (organization_id = public.get_my_org_id());

-- 3. INITIAL SEED RULES (Optional, can be managed via UI)
-- Insert default rules for a new organization (this would usually be in a setup script)
/*
INSERT INTO public.workflow_rules (organization_id, name, trigger_event, action_type, configuration)
SELECT id, 'Auto-Invoice on Approval', 'proposal_approved', 'create_invoice', '{"due_days": 7}' FROM public.organizations;
*/

-- 4. LOGGING HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.log_workflow_run(
  p_rule_id UUID,
  p_entity_id UUID,
  p_status TEXT,
  p_error TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.workflow_logs (rule_id, organization_id, trigger_entity_id, status, error_message, metadata)
    VALUES (p_rule_id, public.get_my_org_id(), p_entity_id, p_status, p_error, p_metadata)
    RETURNING id INTO v_log_id;
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. TRIGGER: Automatic Client Activation on Payment
-- This is a high-level DB workflow example
CREATE OR REPLACE FUNCTION public.auto_activate_client_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- If a payment is verified and tied to an invoice
    IF (NEW.status = 'verified') THEN
        -- Find the client associated with this payment's invoice
        UPDATE public.clients
        SET updated_at = now() -- We could have a 'status' column in clients too
        WHERE id IN (
            SELECT client_id FROM public.invoices WHERE id = NEW.invoice_id
        );
        
        -- Log the automation event
        PERFORM public.log_workflow_run(
            NULL, -- System default rule
            NEW.id,
            'success',
            NULL,
            jsonb_build_object('action', 'CLIENT_ACTIVATION', 'invoice_id', NEW.invoice_id)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_auto_activate_client ON public.payments;
CREATE TRIGGER tr_auto_activate_client
    AFTER UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_activate_client_on_payment();

-- ==============================================================================
-- DONE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
