-- ==============================================================================
-- ENTERPRISE NOTIFICATION ENGINE (Event-Driven)
-- Handles real-time in-app alerts triggered by database events
-- ==============================================================================

-- 1. NOTIFICATIONS TABLE (Core)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'assignment', 'billing', 'system', 'project', 'mention'
  link TEXT,
  is_read BOOLEAN DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Performance: Filtered index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications (user_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_isolation" ON public.notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND organization_id = public.get_my_org_id());

-- 2. TRIGGER FUNCTION: Unified Notification Dispatcher
CREATE OR REPLACE FUNCTION public.notify_on_event()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_title TEXT;
    v_message TEXT;
    v_type TEXT;
    v_recipient_id UUID;
    v_link TEXT;
BEGIN
    v_org_id := COALESCE(NEW.organization_id, OLD.organization_id);

    -- A. TASK ASSIGNMENT
    IF (TG_TABLE_NAME = 'tasks' AND TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to AND NEW.assigned_to IS NOT NULL) THEN
        v_title := 'New Task Assigned';
        v_message := 'You have been assigned to: ' || NEW.title;
        v_type := 'assignment';
        v_recipient_id := NEW.assigned_to;
        v_link := '/tasks';

    -- B. PROPOSAL APPROVAL
    ELSIF (TG_TABLE_NAME = 'proposals' AND TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved') THEN
        v_title := 'Proposal Approved';
        v_message := 'Your proposal "' || NEW.title || '" has been approved.';
        v_type := 'billing';
        v_recipient_id := NEW.user_id; -- Notify the creator
        v_link := '/billing';

    -- C. PAYMENT RECEIVED (Verified)
    ELSIF (TG_TABLE_NAME = 'payments' AND (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'verified') THEN
        v_title := 'Payment Verified';
        v_message := 'A payment of ' || NEW.amount || ' for invoice ' || NEW.invoice_id || ' has been verified.';
        v_type := 'billing';
        -- Notify all admins in the org
        FOR v_recipient_id IN SELECT id FROM public.profiles WHERE organization_id = v_org_id AND role IN ('admin', 'super_admin') LOOP
            INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
            VALUES (v_recipient_id, v_org_id, v_title, v_message, v_type, '/billing');
        END LOOP;
        RETURN NEW; -- Exit as we handled loop manually

    -- D. PROJECT DELAY
    ELSIF (TG_TABLE_NAME = 'projects' AND TG_OP = 'UPDATE' AND OLD.status != 'delayed' AND NEW.status = 'delayed') THEN
        v_title := 'Project Delayed';
        v_message := 'Project "' || NEW.name || '" status has been changed to Delayed.';
        v_type := 'project';
        v_recipient_id := NEW.manager_id;
        v_link := '/projects/' || NEW.id;

    END IF;

    -- Standard Insert for single recipient
    IF v_recipient_id IS NOT NULL AND v_recipient_id != auth.uid() THEN
        INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
        VALUES (v_recipient_id, v_org_id, v_title, v_message, v_type, v_link);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. REGISTER TRIGGERS
DROP TRIGGER IF EXISTS tr_notify_task_assignment ON public.tasks;
CREATE TRIGGER tr_notify_task_assignment AFTER UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.notify_on_event();

DROP TRIGGER IF EXISTS tr_notify_proposal_approval ON public.proposals;
CREATE TRIGGER tr_notify_proposal_approval AFTER UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.notify_on_event();

DROP TRIGGER IF EXISTS tr_notify_payment_verified ON public.payments;
CREATE TRIGGER tr_notify_payment_verified AFTER INSERT OR UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.notify_on_event();

DROP TRIGGER IF EXISTS tr_notify_project_delay ON public.projects;
CREATE TRIGGER tr_notify_project_delay AFTER UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.notify_on_event();

-- 4. PROCEDURE: Detect Overdue Invoices & Notify
-- This should be called by a cron job or background worker
CREATE OR REPLACE FUNCTION public.check_overdue_notifications()
RETURNS VOID AS $$
DECLARE
    v_inv RECORD;
    v_admin_id UUID;
BEGIN
    FOR v_inv IN 
        SELECT i.* 
        FROM public.invoices i
        WHERE i.status = 'sent' AND i.due_date < now()
    LOOP
        -- Update status to overdue
        UPDATE public.invoices SET status = 'overdue' WHERE id = v_inv.id;

        -- Notify Admins
        FOR v_admin_id IN SELECT id FROM public.profiles WHERE organization_id = v_inv.organization_id AND role IN ('admin', 'super_admin') LOOP
            INSERT INTO public.notifications (user_id, organization_id, title, message, type, link)
            VALUES (v_admin_id, v_inv.organization_id, 'Overdue Invoice', 'Invoice #' || v_inv.invoice_number || ' is now overdue.', 'billing', '/billing');
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- DONE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
