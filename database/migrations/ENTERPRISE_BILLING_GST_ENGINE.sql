-- ==============================================================================
-- ENTERPRISE BILLING & GST ENGINE SCHEMA
-- Replaces basic billing with full Zoho/Tally-like financial architecture
-- ==============================================================================

-- 1. GST PROFILES (Org-level Tax Settings)
CREATE TABLE IF NOT EXISTS public.gst_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  gstin VARCHAR(15),
  legal_name TEXT,
  trade_name TEXT,
  pan_number VARCHAR(10),
  state_code VARCHAR(2), -- e.g., '32' for Kerala
  is_registered BOOLEAN DEFAULT true,
  address JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TAX RULES MASTER
CREATE TABLE IF NOT EXISTS public.tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  name TEXT NOT NULL, -- e.g., 'GST 18%', 'IGST 18%'
  type VARCHAR(20) NOT NULL, -- 'intra_state', 'inter_state', 'export', 'exempt'
  rate_percent DECIMAL(5,2) NOT NULL,
  cgst_percent DECIMAL(5,2) DEFAULT 0,
  sgst_percent DECIMAL(5,2) DEFAULT 0,
  igst_percent DECIMAL(5,2) DEFAULT 0,
  cess_percent DECIMAL(5,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Note: In a real system, you'd seed common tax rules, but users can create their own.

-- Add GST fields to Clients table (we'll alter existing if it doesn't have them)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='gstin') THEN
        ALTER TABLE public.clients ADD COLUMN gstin VARCHAR(15);
        ALTER TABLE public.clients ADD COLUMN gst_treatment VARCHAR(30) DEFAULT 'unregistered'; -- regular, composition, unregistered, overseas, sez
        ALTER TABLE public.clients ADD COLUMN state_code VARCHAR(2);
        ALTER TABLE public.clients ADD COLUMN place_of_supply VARCHAR(2);
        ALTER TABLE public.clients ADD COLUMN billing_address JSONB;
        ALTER TABLE public.clients ADD COLUMN shipping_address JSONB;
    END IF;
END $$;


-- 3. ESTIMATES
CREATE TABLE IF NOT EXISTS public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  estimate_number VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  expiry_date DATE,
  status VARCHAR(30) DEFAULT 'draft', -- draft, sent, viewed, approved, rejected, converted
  subtotal DECIMAL(15,2) DEFAULT 0,
  total_discount DECIMAL(15,2) DEFAULT 0,
  total_tax DECIMAL(15,2) DEFAULT 0,
  grand_total DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, estimate_number)
);

CREATE TABLE IF NOT EXISTS public.estimate_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID REFERENCES public.estimates(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  hsn_sac VARCHAR(20),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_value DECIMAL(15,2) DEFAULT 0,
  tax_rule_id UUID REFERENCES public.tax_rules(id),
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  cess_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0
);

-- 4. PROFORMA INVOICES
CREATE TABLE IF NOT EXISTS public.proforma_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,
  proforma_number VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  expiry_date DATE,
  status VARCHAR(30) DEFAULT 'draft', -- draft, sent, accepted, invoiced
  subtotal DECIMAL(15,2) DEFAULT 0,
  total_discount DECIMAL(15,2) DEFAULT 0,
  total_tax DECIMAL(15,2) DEFAULT 0,
  grand_total DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, proforma_number)
);

CREATE TABLE IF NOT EXISTS public.proforma_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proforma_id UUID REFERENCES public.proforma_invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  hsn_sac VARCHAR(20),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_value DECIMAL(15,2) DEFAULT 0,
  tax_rule_id UUID REFERENCES public.tax_rules(id),
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0
);

-- 5. INVOICES (GST Tax Invoices)
-- We might have an existing `invoices` table. Let's rename it to legacy_invoices if we need to completely replace, or just ALTER it.
-- Based on the user prompt: "COMPLETELY redesign and upgrade", we will create a clean schema. If `invoices` exists, this will attempt to create IF NOT EXISTS, which might leave the old schema.
-- Let's drop and recreate or alter. Given this is a fresh vibe coding context, I'll drop the old ones (cascade) to ensure the new schema is pure.
-- WARNING: Dropping tables in production is dangerous. We will use a safe rename strategy.

DO $$
BEGIN
    -- Only rename 'invoices' if 'legacy_invoices' does NOT already exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='invoices' AND table_schema='public') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='legacy_invoices' AND table_schema='public') THEN
        ALTER TABLE public.invoices RENAME TO legacy_invoices;
    END IF;
    
    -- Only rename 'payments' if 'legacy_payments' does NOT already exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='payments' AND table_schema='public') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='legacy_payments' AND table_schema='public') THEN
        ALTER TABLE public.payments RENAME TO legacy_payments;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  proforma_id UUID REFERENCES public.proforma_invoices(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  invoice_number VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  due_date DATE,
  status VARCHAR(30) DEFAULT 'draft', -- draft, sent, partially_paid, paid, overdue, cancelled
  place_of_supply VARCHAR(2), -- State code
  reverse_charge BOOLEAN DEFAULT false,
  subtotal DECIMAL(15,2) DEFAULT 0,
  total_discount DECIMAL(15,2) DEFAULT 0,
  total_tax DECIMAL(15,2) DEFAULT 0,
  round_off DECIMAL(5,2) DEFAULT 0,
  grand_total DECIMAL(15,2) DEFAULT 0,
  amount_paid DECIMAL(15,2) DEFAULT 0,
  amount_due DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  terms TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, invoice_number)
);

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT,
  hsn_sac VARCHAR(20),
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  taxable_value DECIMAL(15,2) DEFAULT 0,
  tax_rule_id UUID REFERENCES public.tax_rules(id),
  cgst_amount DECIMAL(15,2) DEFAULT 0,
  sgst_amount DECIMAL(15,2) DEFAULT 0,
  igst_amount DECIMAL(15,2) DEFAULT 0,
  cess_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) DEFAULT 0
);

-- Invoice Taxes (for easy GSTR reports)
CREATE TABLE IF NOT EXISTS public.invoice_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  tax_rule_id UUID REFERENCES public.tax_rules(id),
  tax_name TEXT,
  taxable_amount DECIMAL(15,2) DEFAULT 0,
  tax_amount DECIMAL(15,2) DEFAULT 0
);

-- 6. PAYMENTS & RECEIPTS
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  payment_number VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  payment_mode VARCHAR(30), -- cash, bank_transfer, upi, cheque, gateway
  reference_number TEXT,
  status VARCHAR(30) DEFAULT 'verified', -- pending, verified, failed, refunded
  bank_charges DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, payment_number)
);

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount_applied DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. CLIENT STATEMENTS (LEDGER)
CREATE TABLE IF NOT EXISTS public.client_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  document_id UUID NOT NULL, -- can be invoice_id or payment_id
  document_type VARCHAR(30) NOT NULL, -- 'invoice', 'payment', 'credit_note', 'opening_balance'
  document_number VARCHAR(50),
  description TEXT,
  debit DECIMAL(15,2) DEFAULT 0, -- increases amount owed (invoice)
  credit DECIMAL(15,2) DEFAULT 0, -- decreases amount owed (payment)
  running_balance DECIMAL(15,2) NOT NULL,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- RLS POLICIES (Data Isolation)
-- ==============================================================================

ALTER TABLE public.gst_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proforma_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_statements ENABLE ROW LEVEL SECURITY;

-- Helper to quickly build isolated policies
CREATE OR REPLACE PROCEDURE create_org_isolated_policy(table_name TEXT)
LANGUAGE plpgsql AS $$
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_isolation" ON public.%1$s', table_name);
    EXECUTE format('
        CREATE POLICY "%1$s_isolation" ON public.%1$s
        FOR ALL TO authenticated
        USING (organization_id = public.get_my_org_id())
        WITH CHECK (organization_id = public.get_my_org_id())
    ', table_name);
END;
$$;

CALL create_org_isolated_policy('gst_profiles');
CALL create_org_isolated_policy('tax_rules');
CALL create_org_isolated_policy('estimates');
CALL create_org_isolated_policy('proforma_invoices');
CALL create_org_isolated_policy('invoices');
CALL create_org_isolated_policy('payments');
CALL create_org_isolated_policy('client_statements');

-- Policies for item tables (derived from parent)
DROP POLICY IF EXISTS "estimate_items_isolation" ON public.estimate_items;
CREATE POLICY "estimate_items_isolation" ON public.estimate_items FOR ALL TO authenticated
USING (estimate_id IN (SELECT id FROM public.estimates WHERE organization_id = public.get_my_org_id()));

DROP POLICY IF EXISTS "proforma_items_isolation" ON public.proforma_items;
CREATE POLICY "proforma_items_isolation" ON public.proforma_items FOR ALL TO authenticated
USING (proforma_id IN (SELECT id FROM public.proforma_invoices WHERE organization_id = public.get_my_org_id()));

DROP POLICY IF EXISTS "invoice_items_isolation" ON public.invoice_items;
CREATE POLICY "invoice_items_isolation" ON public.invoice_items FOR ALL TO authenticated
USING (invoice_id IN (SELECT id FROM public.invoices WHERE organization_id = public.get_my_org_id()));

DROP POLICY IF EXISTS "invoice_taxes_isolation" ON public.invoice_taxes;
CREATE POLICY "invoice_taxes_isolation" ON public.invoice_taxes FOR ALL TO authenticated
USING (invoice_id IN (SELECT id FROM public.invoices WHERE organization_id = public.get_my_org_id()));

DROP POLICY IF EXISTS "payment_receipts_isolation" ON public.payment_receipts;
CREATE POLICY "payment_receipts_isolation" ON public.payment_receipts FOR ALL TO authenticated
USING (payment_id IN (SELECT id FROM public.payments WHERE organization_id = public.get_my_org_id()));

-- ==============================================================================
-- TRIGGERS & AUTOMATION
-- ==============================================================================

-- 1. Auto-update Invoice Amounts & Status on Payment Receipt
CREATE OR REPLACE FUNCTION update_invoice_balance_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the invoice amount_paid and amount_due
    UPDATE public.invoices
    SET 
        amount_paid = amount_paid + NEW.amount_applied,
        amount_due = grand_total - (amount_paid + NEW.amount_applied),
        status = CASE 
            WHEN grand_total - (amount_paid + NEW.amount_applied) <= 0 THEN 'paid'
            ELSE 'partially_paid'
        END
    WHERE id = NEW.invoice_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_invoice_balance ON public.payment_receipts;
CREATE TRIGGER trigger_update_invoice_balance
AFTER INSERT ON public.payment_receipts
FOR EACH ROW EXECUTE FUNCTION update_invoice_balance_on_payment();

-- 2. Client Statement Ledger Trigger (Invoices)
CREATE OR REPLACE FUNCTION log_invoice_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_last_balance DECIMAL(15,2) := 0;
BEGIN
    IF NEW.status = 'sent' AND (TG_OP = 'INSERT' OR OLD.status = 'draft') THEN
        -- Get the last running balance
        SELECT running_balance INTO v_last_balance 
        FROM public.client_statements 
        WHERE client_id = NEW.client_id 
        ORDER BY created_at DESC LIMIT 1;
        
        IF v_last_balance IS NULL THEN v_last_balance := 0; END IF;

        -- Insert a debit record
        INSERT INTO public.client_statements (
            organization_id, client_id, transaction_date, document_id, 
            document_type, document_number, description, debit, running_balance
        ) VALUES (
            NEW.organization_id, NEW.client_id, NEW.date, NEW.id,
            'invoice', NEW.invoice_number, 'Invoice Generated', NEW.grand_total, v_last_balance + NEW.grand_total
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_invoice_to_ledger ON public.invoices;
CREATE TRIGGER trigger_log_invoice_to_ledger
AFTER INSERT OR UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION log_invoice_to_ledger();

-- 3. Client Statement Ledger Trigger (Payments)
CREATE OR REPLACE FUNCTION log_payment_to_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_last_balance DECIMAL(15,2) := 0;
BEGIN
    IF NEW.status = 'verified' AND (TG_OP = 'INSERT' OR OLD.status = 'pending') THEN
        -- Get the last running balance
        SELECT running_balance INTO v_last_balance 
        FROM public.client_statements 
        WHERE client_id = NEW.client_id 
        ORDER BY created_at DESC LIMIT 1;
        
        IF v_last_balance IS NULL THEN v_last_balance := 0; END IF;

        -- Insert a credit record
        INSERT INTO public.client_statements (
            organization_id, client_id, transaction_date, document_id, 
            document_type, document_number, description, credit, running_balance
        ) VALUES (
            NEW.organization_id, NEW.client_id, NEW.date, NEW.id,
            'payment', NEW.payment_number, 'Payment Received (' || NEW.payment_mode || ')', NEW.amount, v_last_balance - NEW.amount
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_log_payment_to_ledger ON public.payments;
CREATE TRIGGER trigger_log_payment_to_ledger
AFTER INSERT OR UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION log_payment_to_ledger();
