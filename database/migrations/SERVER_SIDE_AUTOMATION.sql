-- ==============================================================================
-- ENTERPRISE AUTOMATION ENGINE SCHEMA
-- ==============================================================================
-- This script implements a reliable, server-side automation framework
-- replacing the unsafe client-side execution engine.

-- 1. AUTOMATION LOGS (Audit & Debugging)
CREATE TABLE IF NOT EXISTS public.automation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    automation_type TEXT NOT NULL,
    target_id UUID,
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed', 'retrying')),
    payload JSONB DEFAULT '{}',
    error_message TEXT,
    retry_count INT DEFAULT 0,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on logs
ALTER TABLE public.automation_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Orgs can view their own automation logs" ON public.automation_logs;
CREATE POLICY "Orgs can view their own automation logs" 
    ON public.automation_logs FOR SELECT 
    TO authenticated 
    USING (organization_id = (SELECT get_my_org_id()));

-- 2. AUTOMATION QUEUE (For scheduled/async tasks)
CREATE TABLE IF NOT EXISTS public.automation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID,
    task_name TEXT NOT NULL,
    payload JSONB NOT NULL,
    scheduled_for TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    last_error TEXT,
    retry_count INT DEFAULT 0,
    idempotency_key TEXT UNIQUE, -- Prevents duplicate executions
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.automation_queue ENABLE ROW LEVEL SECURITY;

-- 3. CORE AUTOMATION RPC: process_overdue_invoices
-- This should be called by a Cron job or Edge Function.
CREATE OR REPLACE FUNCTION public.process_overdue_invoices()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_invoice RECORD;
BEGIN
    FOR v_invoice IN 
        SELECT i.id, i.organization_id, i.invoice_number, i.amount, c.email, c.name
        FROM invoices i
        JOIN clients c ON c.id = i.client_id
        WHERE i.status = 'sent' 
          AND i.due_date < CURRENT_DATE
          AND NOT EXISTS (
              SELECT 1 FROM automation_logs 
              WHERE target_id = i.id 
                AND automation_type = 'OVERDUE_INVOICE_ALERT'
                AND executed_at > (NOW() - INTERVAL '24 hours') -- Avoid spamming
          )
    LOOP
        -- Log the attempt
        INSERT INTO automation_logs (organization_id, automation_type, target_id, status, payload)
        VALUES (v_invoice.organization_id, 'OVERDUE_INVOICE_ALERT', v_invoice.id, 'pending', 
                jsonb_build_object('email', v_invoice.email, 'amount', v_invoice.amount));

        -- Create Notification
        INSERT INTO notifications (organization_id, user_id, title, message, type, link)
        SELECT v_invoice.organization_id, p.id, 'Overdue Invoice', 
               'Invoice ' || v_invoice.invoice_number || ' is overdue.', 'billing', '/billing/' || v_invoice.id
        FROM profiles p
        WHERE p.organization_id = v_invoice.organization_id AND p.role IN ('admin', 'super_admin');

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- 4. CORE AUTOMATION RPC: process_stale_leads
CREATE OR REPLACE FUNCTION public.process_stale_leads()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INT := 0;
    v_lead RECORD;
BEGIN
    FOR v_lead IN 
        SELECT l.id, l.organization_id, l.first_name, l.last_name, l.user_id
        FROM leads l
        WHERE l.status NOT IN ('converted', 'lost')
          AND l.updated_at < (NOW() - INTERVAL '3 days')
          AND NOT EXISTS (
              SELECT 1 FROM automation_logs 
              WHERE target_id = l.id 
                AND automation_type = 'STALE_LEAD_REMINDER'
                AND executed_at > (NOW() - INTERVAL '7 days')
          )
    LOOP
        -- Create Notification for the owner
        INSERT INTO notifications (organization_id, user_id, title, message, type, link)
        VALUES (v_lead.organization_id, v_lead.user_id, 'Stale Lead Reminder', 
                'Lead ' || v_lead.first_name || ' ' || v_lead.last_name || ' hasn''t been updated in 3 days.', 'system', '/crm');

        INSERT INTO automation_logs (organization_id, automation_type, target_id, status)
        VALUES (v_lead.organization_id, 'STALE_LEAD_REMINDER', v_lead.id, 'success');

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- 5. CRON TRIGGER SIMULATION (For local dev/manual trigger)
-- In production, use Supabase pg_cron:
-- SELECT cron.schedule('0 0 * * *', 'SELECT process_overdue_invoices()');
-- SELECT cron.schedule('0 0 * * *', 'SELECT process_stale_leads()');

NOTIFY pgrst, 'reload schema';
