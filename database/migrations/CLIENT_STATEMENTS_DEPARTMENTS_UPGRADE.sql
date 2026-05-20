-- ==============================================================================
-- ENTERPRISE ERP ARCHITECT: CLIENT STATEMENT & DEPARTMENT OPERATIONS SCHEMA
-- ==============================================================================
-- Normalized payment ledgers, double-entry statement tracking, dynamic department
-- hierarchies, dynamic project modules provisioning, and RLS multi-tenant gates.
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- PART 0: SAFE BOOTSTRAP DEPARTMENTS SCHEMA (REDUNDANCY SAFETY NET)
-- ==============================================================================

-- 1. Departments Registry
CREATE TABLE IF NOT EXISTS public.departments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  leader_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_departments_organization ON public.departments(organization_id);
CREATE INDEX IF NOT EXISTS idx_departments_slug ON public.departments(slug);

-- 2. Normalised Department Members Mapping
CREATE TABLE IF NOT EXISTS public.department_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  is_primary    BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(department_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_dept_members_profile ON public.department_members(profile_id);
CREATE INDEX IF NOT EXISTS idx_dept_members_dept ON public.department_members(department_id);

-- 3. Dynamic Department Settings
CREATE TABLE IF NOT EXISTS public.department_settings (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id          UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE UNIQUE,
  weekly_hours_capacity  INTEGER DEFAULT 40 CHECK (weekly_hours_capacity > 0),
  escalation_email       TEXT,
  sla_threshold_hours    INTEGER DEFAULT 24 CHECK (sla_threshold_hours >= 0),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Dynamic KPI Catalog
CREATE TABLE IF NOT EXISTS public.department_kpis (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  metric_key    TEXT NOT NULL,
  target_value  NUMERIC(12, 2) NOT NULL,
  current_value NUMERIC(12, 2) DEFAULT 0.00,
  unit          TEXT DEFAULT '',
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_kpis_dept ON public.department_kpis(department_id);
CREATE INDEX IF NOT EXISTS idx_dept_kpis_key ON public.department_kpis(metric_key);

-- 5. Dashboard Configuration Layout Bindings
CREATE TABLE IF NOT EXISTS public.department_dashboards (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id   UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE UNIQUE,
  layout_config   JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled_widgets TEXT[] NOT NULL DEFAULT '{}'::text[],
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Isolated Department Operational Reports Archive
CREATE TABLE IF NOT EXISTS public.department_reports (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  report_type   TEXT NOT NULL CHECK (report_type IN ('productivity', 'attendance', 'workload', 'utilization')),
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dept_reports_dept ON public.department_reports(department_id);

-- Trigger for default provisioning
CREATE OR REPLACE FUNCTION provision_department_defaults()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.department_settings (department_id, weekly_hours_capacity, escalation_email, sla_threshold_hours)
  VALUES (NEW.id, 40, LOWER(CONCAT(NEW.slug, '-leads@enterprise.com')), 24)
  ON CONFLICT (department_id) DO NOTHING;

  INSERT INTO public.department_dashboards (department_id, layout_config, enabled_widgets)
  VALUES (
    NEW.id,
    CASE 
      WHEN NEW.slug = 'development' THEN '{"columns": 3, "widgets": [{"name": "active_sprints", "h": 2}, {"name": "bug_backlog", "h": 1}]}'::jsonb
      WHEN NEW.slug = 'sales' THEN '{"columns": 3, "widgets": [{"name": "pipeline_value", "h": 2}, {"name": "deal_tracker", "h": 1}]}'::jsonb
      WHEN NEW.slug = 'seo' THEN '{"columns": 3, "widgets": [{"name": "campaign_status", "h": 2}, {"name": "keywords_tracked", "h": 1}]}'::jsonb
      ELSE '{"columns": 3, "widgets": [{"name": "activity_log", "h": 2}, {"name": "general_tasks", "h": 1}]}'::jsonb
    END,
    CASE
      WHEN NEW.slug = 'development' THEN ARRAY['development_projects', 'sprint_tasks', 'bug_tracker', 'resource_workload']
      WHEN NEW.slug = 'sales' THEN ARRAY['sales_pipeline', 'conversion_metrics', 'proposal_tracker', 'revenue_gauge']
      WHEN NEW.slug = 'seo' THEN ARRAY['seo_campaigns', 'keyword_ranks', 'content_deadlines', 'deliverables_grid']
      ELSE ARRAY['general_metrics', 'task_distribution', 'activity_stream']
    END
  ) ON CONFLICT (department_id) DO NOTHING;

  INSERT INTO public.department_kpis (department_id, name, metric_key, target_value, current_value, unit)
  VALUES 
    (NEW.id, 'Task Completion Rate', 'completion_rate', 90.00, 0.00, '%'),
    (NEW.id, 'Resource Capacity Logged', 'logged_capacity', 160.00, 0.00, 'hrs')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_provision_department_defaults') THEN
    CREATE TRIGGER trg_provision_department_defaults
    AFTER INSERT ON public.departments
    FOR EACH ROW
    EXECUTE FUNCTION provision_department_defaults();
  END IF;
END $$;

-- Enable RLS safely on newly built safety nets
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_reports ENABLE ROW LEVEL SECURITY;

-- Safe policies creation (Redundancy bypass)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_departments_access' AND tablename = 'departments') THEN
    CREATE POLICY tenant_departments_access ON public.departments FOR ALL USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())) WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_members_access' AND tablename = 'department_members') THEN
    CREATE POLICY tenant_members_access ON public.department_members FOR ALL USING (department_id IN (SELECT id FROM public.departments WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_settings_access' AND tablename = 'department_settings') THEN
    CREATE POLICY tenant_settings_access ON public.department_settings FOR ALL USING (department_id IN (SELECT id FROM public.departments WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_kpis_access' AND tablename = 'department_kpis') THEN
    CREATE POLICY tenant_kpis_access ON public.department_kpis FOR ALL USING (department_id IN (SELECT id FROM public.departments WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_dashboards_access' AND tablename = 'department_dashboards') THEN
    CREATE POLICY tenant_dashboards_access ON public.department_dashboards FOR ALL USING (department_id IN (SELECT id FROM public.departments WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_reports_access' AND tablename = 'department_reports') THEN
    CREATE POLICY tenant_reports_access ON public.department_reports FOR ALL USING (department_id IN (SELECT id FROM public.departments WHERE organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())));
  END IF;
END $$;

-- ==============================================================================
-- PART 1: CLIENT STATEMENT SYSTEM
-- ==============================================================================

-- 1. Create Payment Methods Registry
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name            TEXT NOT NULL,
  code            TEXT NOT NULL CHECK (code IN ('cash', 'bank_transfer', 'upi', 'card', 'cheque', 'online_gateway')),
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_payment_methods_org ON public.payment_methods(organization_id);

-- Seed Default Payment Methods for new organization contexts
CREATE OR REPLACE FUNCTION seed_organization_payment_methods(p_org_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.payment_methods (organization_id, name, code, is_active)
  VALUES 
    (p_org_id, 'Cash Payment', 'cash', TRUE),
    (p_org_id, 'Bank Transfer / NEFT', 'bank_transfer', TRUE),
    (p_org_id, 'UPI / GPay / PhonePe', 'upi', TRUE),
    (p_org_id, 'Credit / Debit Card', 'card', TRUE),
    (p_org_id, 'Cheque Payment', 'cheque', TRUE),
    (p_org_id, 'Online Stripe Gateway', 'online_gateway', TRUE)
  ON CONFLICT (organization_id, code) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 2. Client Payments Ledger
CREATE TABLE IF NOT EXISTS public.client_payments (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount            NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
  payment_date      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_method    TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank_transfer', 'upi', 'card', 'cheque', 'online_gateway')),
  transaction_id    TEXT,
  notes             TEXT,
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_payments_org ON public.client_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_client ON public.client_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_date ON public.client_payments(payment_date);

-- 3. Invoices Payment Allocations
CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  payment_id        UUID NOT NULL REFERENCES public.client_payments(id) ON DELETE CASCADE,
  invoice_id        UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  project_id        UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  amount_allocated  NUMERIC(15, 2) NOT NULL CHECK (amount_allocated > 0),
  allocated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_allocations_invoice ON public.payment_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_allocations_project ON public.payment_allocations(project_id);

-- 4. Client Double-Entry Financial Statements Timeline
CREATE TABLE IF NOT EXISTS public.client_statements (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  client_id         UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  entry_type        TEXT NOT NULL CHECK (entry_type IN ('invoice', 'payment', 'refund', 'adjustment')),
  entry_date        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reference_id      UUID NOT NULL, -- references invoice_id or payment_id
  reference_number  TEXT NOT NULL, -- e.g. 'INV-2026-001' or 'PAY-1928'
  debit             NUMERIC(15, 2) DEFAULT 0.00 CHECK (debit >= 0),  -- invoice amount increases receivable
  credit            NUMERIC(15, 2) DEFAULT 0.00 CHECK (credit >= 0), -- payment received decreases receivable
  running_balance   NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  description       TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statements_client_timeline ON public.client_statements(client_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_statements_org ON public.client_statements(organization_id);

-- 5. Realtime Client Balance Cache Summaries
CREATE TABLE IF NOT EXISTS public.client_balance_summary (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id     UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  client_id           UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE UNIQUE,
  total_billed        NUMERIC(15, 2) DEFAULT 0.00 CHECK (total_billed >= 0),
  total_received      NUMERIC(15, 2) DEFAULT 0.00 CHECK (total_received >= 0),
  overdue_amount      NUMERIC(15, 2) DEFAULT 0.00 CHECK (overdue_amount >= 0),
  advance_balance     NUMERIC(15, 2) DEFAULT 0.00 CHECK (advance_balance >= 0),
  outstanding_balance NUMERIC(15, 2) DEFAULT 0.00,
  last_updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balance_summary_client ON public.client_balance_summary(client_id);
CREATE INDEX IF NOT EXISTS idx_balance_summary_org ON public.client_balance_summary(organization_id);

-- ==============================================================================
-- PART 2: DYNAMIC EMPLOYEE REPORTING HIERARCHY
-- ==============================================================================

-- 1. Extend legacy Profiles table with reporting manager links
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reporting_manager_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_lead_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. Create Employee Team Mapping for multiple department scopes
CREATE TABLE IF NOT EXISTS public.employee_team_mapping (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  employee_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id   UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  reporting_to_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_team_mapping_emp ON public.employee_team_mapping(employee_id);
CREATE INDEX IF NOT EXISTS idx_team_mapping_dept ON public.employee_team_mapping(department_id);

-- ==============================================================================
-- PART 3: AUTOMATION TRIGGERS & PROCEDURES (100% TRANSACTIONAL)
-- ==============================================================================

-- Trigger to recalculate client statements timeline and summaries
CREATE OR REPLACE FUNCTION public.rebuild_client_statement_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_org_id UUID;
  r RECORD;
  v_balance NUMERIC(15, 2) := 0.00;
  v_billed NUMERIC(15, 2) := 0.00;
  v_received NUMERIC(15, 2) := 0.00;
  v_overdue NUMERIC(15, 2) := 0.00;
  v_advance NUMERIC(15, 2) := 0.00;
BEGIN
  -- Determine Client Context
  IF TG_OP = 'DELETE' THEN
    v_client_id := OLD.client_id;
    v_org_id := OLD.organization_id;
  ELSE
    v_client_id := NEW.client_id;
    v_org_id := NEW.organization_id;
  END IF;

  -- 1. Wipe client statements timeline for full recalculation
  DELETE FROM public.client_statements WHERE client_id = v_client_id;

  -- 2. Insert Invoices as Debits
  INSERT INTO public.client_statements (organization_id, client_id, entry_type, entry_date, reference_id, reference_number, debit, credit, running_balance, description)
  SELECT 
    organization_id,
    client_id,
    'invoice'::text,
    created_at,
    id,
    invoice_number,
    amount,
    0.00,
    0.00,
    CONCAT('Invoice generated: ', invoice_number)
  FROM public.invoices
  WHERE client_id = v_client_id AND (deleted_at IS NULL);

  -- 3. Insert Payments as Credits
  INSERT INTO public.client_statements (organization_id, client_id, entry_type, entry_date, reference_id, reference_number, debit, credit, running_balance, description)
  SELECT 
    organization_id,
    client_id,
    'payment'::text,
    payment_date,
    id,
    CONCAT('PAY-', UPPER(SUBSTRING(id::text, 1, 6))),
    0.00,
    amount,
    0.00,
    CONCAT('Payment received via ', UPPER(payment_method), ' (Txn ID: ', COALESCE(transaction_id, 'N/A'), ')')
  FROM public.client_payments
  WHERE client_id = v_client_id;

  -- 4. Calculate chronological running balance via cursor
  FOR r IN 
    SELECT id, debit, credit 
    FROM public.client_statements 
    WHERE client_id = v_client_id 
    ORDER BY entry_date ASC, created_at ASC
  LOOP
    v_balance := v_balance + r.debit - r.credit;
    UPDATE public.client_statements SET running_balance = v_balance WHERE id = r.id;
  END LOOP;

  -- 5. Calculate summaries
  SELECT COALESCE(SUM(amount), 0.00) INTO v_billed FROM public.invoices WHERE client_id = v_client_id AND (deleted_at IS NULL);
  SELECT COALESCE(SUM(amount), 0.00) INTO v_received FROM public.client_payments WHERE client_id = v_client_id;
  
  -- Overdue Calculation (unpaid invoices past due date)
  SELECT COALESCE(SUM(amount), 0.00) INTO v_overdue 
  FROM public.invoices 
  WHERE client_id = v_client_id 
    AND (deleted_at IS NULL) 
    AND status = 'overdue';

  -- Calculate Advance Balance (payments exceeds billed invoices)
  IF v_received > v_billed THEN
    v_advance := v_received - v_billed;
  ELSE
    v_advance := 0.00;
  END IF;

  -- 6. Upsert real-time Summary
  INSERT INTO public.client_balance_summary (organization_id, client_id, total_billed, total_received, overdue_amount, advance_balance, outstanding_balance, last_updated_at)
  VALUES (v_org_id, v_client_id, v_billed, v_received, v_overdue, v_advance, (v_billed - v_received), NOW())
  ON CONFLICT (client_id) DO UPDATE SET 
    total_billed = EXCLUDED.total_billed,
    total_received = EXCLUDED.total_received,
    overdue_amount = EXCLUDED.overdue_amount,
    advance_balance = EXCLUDED.advance_balance,
    outstanding_balance = EXCLUDED.outstanding_balance,
    last_updated_at = NOW();

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind Triggers to Invoices and Payments tables
DROP TRIGGER IF EXISTS trg_invoice_rebuild_ledger ON public.invoices;
CREATE TRIGGER trg_invoice_rebuild_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.rebuild_client_statement_ledger();

DROP TRIGGER IF EXISTS trg_payment_rebuild_ledger ON public.client_payments;
CREATE TRIGGER trg_payment_rebuild_ledger
AFTER INSERT OR UPDATE OR DELETE ON public.client_payments
FOR EACH ROW EXECUTE FUNCTION public.rebuild_client_statement_ledger();


-- ==============================================================================
-- PART 4: DYNAMIC PROJECT & MODULE PROVISIONING FROM LEAD STAGE
-- ==============================================================================

-- Procedure to automatically provision projects, modules, and submodules from a converted lead
CREATE OR REPLACE FUNCTION public.convert_lead_to_operational_project(
  p_lead_id UUID,
  p_department_slug TEXT,
  p_assigned_lead_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_project_id UUID;
  v_org_id UUID;
  v_client_id UUID;
  v_lead_title TEXT;
  v_dept_id UUID;
  v_module_id UUID;
BEGIN
  -- 1. Fetch Lead Information
  SELECT organization_id, client_id, title INTO v_org_id, v_client_id, v_lead_title
  FROM public.leads
  WHERE id = p_lead_id;

  -- 2. Fetch Department ID
  SELECT id INTO v_dept_id FROM public.departments WHERE slug = p_department_slug AND organization_id = v_org_id;
  IF v_dept_id IS NULL THEN
    RAISE EXCEPTION 'Department slug % not found for this tenant.', p_department_slug;
  END IF;

  -- 3. Create Project
  INSERT INTO public.projects (organization_id, client_id, name, status, priority, created_at)
  VALUES (v_org_id, v_client_id, CONCAT(v_lead_title, ' Execution'), 'active', 'medium', NOW())
  RETURNING id INTO v_project_id;

  -- Associate Department with project (if department column exists)
  BEGIN
    ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
    UPDATE public.projects SET department_id = v_dept_id WHERE id = v_project_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;

  -- 4. Automatically provision default structured modules & submodules
  IF p_department_slug = 'development' THEN
    -- Frontend Module
    INSERT INTO public.project_modules (project_id, organization_id, name, description, color, sort_order)
    VALUES (v_project_id, v_org_id, 'Frontend Development', 'Client-side visual layouts and UI integrations', '#0284c7', 0)
    RETURNING id INTO v_module_id;
    
    INSERT INTO public.project_modules (project_id, organization_id, parent_id, name, description, color, sort_order)
    VALUES 
      (v_project_id, v_org_id, v_module_id, 'UI Routing & Architecture', 'Configure responsive pages', '#0284c7', 0),
      (v_project_id, v_org_id, v_module_id, 'State Management Integration', 'Bind queries and states', '#0284c7', 1);

    -- Backend Module
    INSERT INTO public.project_modules (project_id, organization_id, name, description, color, sort_order)
    VALUES (v_project_id, v_org_id, 'Backend Core APIs', 'Database architectures, triggers, and routes', '#4f46e5', 1)
    RETURNING id INTO v_module_id;

    INSERT INTO public.project_modules (project_id, organization_id, parent_id, name, description, color, sort_order)
    VALUES 
      (v_project_id, v_org_id, v_module_id, 'Database Migrations', 'Normalised schema definitions', '#4f46e5', 0),
      (v_project_id, v_org_id, v_module_id, 'API Authentication Gateway', 'OAuth & Session validations', '#4f46e5', 1);

  ELSIF p_department_slug = 'seo' THEN
    -- Analysis Module
    INSERT INTO public.project_modules (project_id, organization_id, name, description, color, sort_order)
    VALUES (v_project_id, v_org_id, 'On-Page Audit', 'Comprehensive keywords research & audits', '#0d9488', 0)
    RETURNING id INTO v_module_id;

    INSERT INTO public.project_modules (project_id, organization_id, parent_id, name, description, color, sort_order)
    VALUES 
      (v_project_id, v_org_id, v_module_id, 'Keywords Analytics', 'Research ranking volumes', '#0d9488', 0),
      (v_project_id, v_org_id, v_module_id, 'Sitemap Configurations', 'Submit search engine webmaster properties', '#0d9488', 1);
  ELSE
    -- General Module
    INSERT INTO public.project_modules (project_id, organization_id, name, description, color, sort_order)
    VALUES (v_project_id, v_org_id, 'Operational Initiation', 'Pre-kickoff alignment', '#64748b', 0)
    RETURNING id INTO v_module_id;
  END IF;

  RETURN v_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- PART 5: MULTI-TENANT ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_balance_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_team_mapping ENABLE ROW LEVEL SECURITY;

-- 1. Payment Methods Policy
DROP POLICY IF EXISTS tenant_payment_methods_all ON public.payment_methods;
CREATE POLICY tenant_payment_methods_all ON public.payment_methods
  FOR ALL USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 2. Client Payments Policy
DROP POLICY IF EXISTS tenant_client_payments_all ON public.client_payments;
CREATE POLICY tenant_client_payments_all ON public.client_payments
  FOR ALL USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 3. Payment Allocations Policy
DROP POLICY IF EXISTS tenant_payment_allocations_all ON public.payment_allocations;
CREATE POLICY tenant_payment_allocations_all ON public.payment_allocations
  FOR ALL USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 4. Client Statements Policy (Isolated boundaries. Team Leads and Employees scope)
DROP POLICY IF EXISTS tenant_client_statements_all ON public.client_statements;
CREATE POLICY tenant_client_statements_all ON public.client_statements
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND (
      -- Global users (Admin, Super Admin, HR) can view all
      EXISTS (
        SELECT 1 FROM public.user_roles ur 
        JOIN public.roles r ON ur.role_id = r.id
        WHERE ur.user_id = auth.uid() AND r.name IN ('Super Admin', 'Administrator', 'HR')
      )
      -- Team Leads or Employees must be actively assigned to billing or client projects
      OR EXISTS (
        SELECT 1 FROM public.department_members dm
        JOIN public.departments d ON dm.department_id = d.id
        WHERE dm.profile_id = auth.uid() AND d.slug IN ('sales', 'billing', 'accounts')
      )
    )
  );

-- 5. Client Balance Summary Policy
DROP POLICY IF EXISTS tenant_client_balance_summary_all ON public.client_balance_summary;
CREATE POLICY tenant_client_balance_summary_all ON public.client_balance_summary
  FOR ALL USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 6. Employee Team Mapping Policy
DROP POLICY IF EXISTS tenant_employee_team_mapping_all ON public.employee_team_mapping;
CREATE POLICY tenant_employee_team_mapping_all ON public.employee_team_mapping
  FOR ALL USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));


-- Seed Client Statements sidebar module registry
INSERT INTO public.module_registry (key, name, icon, route, category, sort_order, permission)
VALUES ('statements', 'Client Statements', 'CreditCard', '/billing/statements', 'top', 8, 'module.billing')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  permission = EXCLUDED.permission;

-- Remove Time Desk from dynamic sidebar module registry
DELETE FROM public.module_registry WHERE key = 'timedesk';

-- Remove Dept Dashboard from dynamic sidebar module registry (integrated inside main dashboard)
DELETE FROM public.module_registry WHERE key = 'dept_dashboard';

-- ==============================================================================
-- PART 6: DATABASE OPTIMIZATIONS & COMPOSITE PERFORMANCE INDEXES
-- ==============================================================================
-- Dynamic Performance Indexing on dynamic join and search dimensions
CREATE INDEX IF NOT EXISTS idx_dept_members_composite ON public.department_members(department_id, profile_id);
CREATE INDEX IF NOT EXISTS idx_dept_kpis_composite ON public.department_kpis(department_id, id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- DONE. CLIENT STATEMENTS & OPERATIONS MODULES REGISTERED SUCCESSFULLY.
-- ==============================================================================
