-- ==============================================================================
-- UPGRADE CLIENT STATEMENTS SCHEMA
-- Renames the old client_statements table if it exists, and recreates it 
-- with the new Enterprise Billing double-entry ledger columns.
-- ==============================================================================

DO $$
BEGIN
    -- Rename 'client_statements' to 'legacy_client_statements' if we haven't already
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='client_statements' AND table_schema='public') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='legacy_client_statements' AND table_schema='public') THEN
        ALTER TABLE public.client_statements RENAME TO legacy_client_statements;
    END IF;
END $$;

-- Now safely create the NEW client_statements ledger table
CREATE TABLE IF NOT EXISTS public.client_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    transaction_date DATE NOT NULL,
    document_id UUID NOT NULL, 
    document_type VARCHAR(30) NOT NULL, 
    document_number VARCHAR(50),
    description TEXT,
    debit DECIMAL(15,2) DEFAULT 0, 
    credit DECIMAL(15,2) DEFAULT 0, 
    running_balance DECIMAL(15,2) NOT NULL,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Re-enable RLS
ALTER TABLE public.client_statements ENABLE ROW LEVEL SECURITY;

-- Re-apply policies
DO $$
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_isolation" ON public.%1$s', 'client_statements');
    EXECUTE format('
        CREATE POLICY "%1$s_isolation" ON public.%1$s
        FOR ALL TO authenticated
        USING (organization_id = public.get_my_org_id())
        WITH CHECK (organization_id = public.get_my_org_id())
    ', 'client_statements');
END;
$$;
