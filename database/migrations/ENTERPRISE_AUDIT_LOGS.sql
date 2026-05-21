-- ==============================================================================
-- ENTERPRISE AUDIT TRAIL SYSTEM
-- Provides an immutable ledger for all critical operational changes.
-- ==============================================================================

-- 1. Create the Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Who made the change
    table_name TEXT NOT NULL,                                       -- Which table was changed
    record_id UUID NOT NULL,                                        -- ID of the record changed
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,                                                 -- State before change
    new_data JSONB,                                                 -- State after change
    created_at TIMESTAMPTZ DEFAULT now()                            -- Immutable timestamp
);

-- 2. Secure the Audit Logs (Append-Only)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins/Super Admins can view logs for their organization
DROP POLICY IF EXISTS "view_org_audit_logs" ON public.audit_logs;
CREATE POLICY "view_org_audit_logs" ON public.audit_logs
    FOR SELECT TO authenticated 
    USING (organization_id = public.get_my_org_id());

-- NO ONE can update or delete audit logs. No policies for UPDATE or DELETE are created.

-- 3. Create the Generic Audit Trigger Function
CREATE OR REPLACE FUNCTION public.audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
    v_org_id UUID;
BEGIN
    -- Try to get the user ID from the Supabase auth context
    v_user_id := auth.uid();
    
    -- Try to get the organization ID (usually present in the record itself)
    -- We use a fallback if the table doesn't have organization_id
    IF TG_OP = 'DELETE' THEN
        BEGIN
            v_org_id := OLD.organization_id;
        EXCEPTION WHEN OTHERS THEN
            v_org_id := '00000000-0000-0000-0000-000000000000'::UUID;
        END;
    ELSE
        BEGIN
            v_org_id := NEW.organization_id;
        EXCEPTION WHEN OTHERS THEN
            v_org_id := '00000000-0000-0000-0000-000000000000'::UUID;
        END;
    END IF;

    -- Record the action
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.audit_logs (organization_id, user_id, table_name, record_id, action, new_data)
        VALUES (v_org_id, v_user_id, TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::JSONB);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only log if something actually changed
        IF row_to_json(OLD)::JSONB != row_to_json(NEW)::JSONB THEN
            INSERT INTO public.audit_logs (organization_id, user_id, table_name, record_id, action, old_data, new_data)
            VALUES (v_org_id, v_user_id, TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.audit_logs (organization_id, user_id, table_name, record_id, action, old_data)
        VALUES (v_org_id, v_user_id, TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::JSONB);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach Triggers to Critical Tables

-- A. Invoices
DROP TRIGGER IF EXISTS audit_invoices_trigger ON public.invoices;
CREATE TRIGGER audit_invoices_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- B. Payments
DROP TRIGGER IF EXISTS audit_payments_trigger ON public.payments;
CREATE TRIGGER audit_payments_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- C. Clients
DROP TRIGGER IF EXISTS audit_clients_trigger ON public.clients;
CREATE TRIGGER audit_clients_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- D. Projects
DROP TRIGGER IF EXISTS audit_projects_trigger ON public.projects;
CREATE TRIGGER audit_projects_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- E. Tasks (Tracking who changes task statuses or deletes them)
DROP TRIGGER IF EXISTS audit_tasks_trigger ON public.tasks;
CREATE TRIGGER audit_tasks_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- F. Work Sessions (Time Desk integrity)
DROP TRIGGER IF EXISTS audit_work_sessions_trigger ON public.work_sessions;
CREATE TRIGGER audit_work_sessions_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.work_sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
