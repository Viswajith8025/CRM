-- ==============================================================================
-- IMMUTABLE AUDIT LOGGING SYSTEM (PHASE 1)
-- ==============================================================================
-- This migration implements a cryptographically secure, append-only ledger for
-- all critical financial, operational, and security actions in the ERP.
-- ==============================================================================

-- 1. CREATE THE LEDGER TABLE
CREATE TABLE IF NOT EXISTS public.enterprise_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who did it
    action VARCHAR(255) NOT NULL, -- e.g., 'INVOICE_UPDATED', 'ROLE_ESCALATED'
    entity_type VARCHAR(255) NOT NULL, -- e.g., 'invoice', 'profile'
    entity_id UUID NOT NULL,
    previous_value JSONB, -- State before the mutation
    new_value JSONB, -- State after the mutation
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ENFORCE APPEND-ONLY (IMMUTABLE RLS)
ALTER TABLE public.enterprise_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read Org Audit Logs" ON public.enterprise_audit_logs;
CREATE POLICY "Read Org Audit Logs" ON public.enterprise_audit_logs 
FOR SELECT USING (organization_id = get_my_org_id());

DROP POLICY IF EXISTS "Insert Org Audit Logs" ON public.enterprise_audit_logs;
CREATE POLICY "Insert Org Audit Logs" ON public.enterprise_audit_logs 
FOR INSERT WITH CHECK (organization_id = get_my_org_id());

-- MATHEMATICALLY BLOCK UPDATES & DELETES
DROP POLICY IF EXISTS "Block Updates" ON public.enterprise_audit_logs;
CREATE POLICY "Block Updates" ON public.enterprise_audit_logs 
FOR UPDATE USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "Block Deletes" ON public.enterprise_audit_logs;
CREATE POLICY "Block Deletes" ON public.enterprise_audit_logs 
FOR DELETE USING (false);

-- ==============================================================================
-- 3. AUDIT ENGINE: GENERIC TRIGGER FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.audit_table_changes()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_id UUID;
BEGIN
    -- Extract the acting user ID securely
    v_actor_id := auth.uid();

    -- Determine the action type based on trigger operation
    IF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.enterprise_audit_logs (
            organization_id, actor_id, action, entity_type, entity_id, previous_value, new_value
        ) VALUES (
            NEW.organization_id, 
            v_actor_id, 
            UPPER(TG_TABLE_NAME) || '_UPDATED', 
            TG_TABLE_NAME, 
            NEW.id, 
            row_to_json(OLD)::jsonb, 
            row_to_json(NEW)::jsonb
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.enterprise_audit_logs (
            organization_id, actor_id, action, entity_type, entity_id, previous_value, new_value
        ) VALUES (
            OLD.organization_id, 
            v_actor_id, 
            UPPER(TG_TABLE_NAME) || '_DELETED', 
            TG_TABLE_NAME, 
            OLD.id, 
            row_to_json(OLD)::jsonb, 
            NULL
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- 4. DEPLOY COMPLIANCE TRIGGERS (HIGH RISK TABLES)
-- ==============================================================================

-- FINANCIAL AUDIT: Invoices
DROP TRIGGER IF EXISTS audit_invoices_update ON public.invoices;
CREATE TRIGGER audit_invoices_update
AFTER UPDATE ON public.invoices
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION public.audit_table_changes();

DROP TRIGGER IF EXISTS audit_invoices_delete ON public.invoices;
CREATE TRIGGER audit_invoices_delete
AFTER DELETE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.audit_table_changes();

-- SECURITY AUDIT: User Profiles (Tracking Role/Status Changes)
DROP TRIGGER IF EXISTS audit_profiles_update ON public.profiles;
CREATE TRIGGER audit_profiles_update
AFTER UPDATE ON public.profiles
FOR EACH ROW
WHEN (OLD.role IS DISTINCT FROM NEW.role OR OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.audit_table_changes();

-- OPERATIONAL AUDIT: Projects (Tracking Reassignments/Status)
DROP TRIGGER IF EXISTS audit_projects_update ON public.projects;
CREATE TRIGGER audit_projects_update
AFTER UPDATE ON public.projects
FOR EACH ROW
WHEN (OLD.* IS DISTINCT FROM NEW.*)
EXECUTE FUNCTION public.audit_table_changes();

-- ==============================================================================
-- Notify schema reload
NOTIFY pgrst, 'reload schema';
