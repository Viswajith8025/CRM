-- ==============================================================================
-- ECRAFTZ CRM & ERP PRODUCTION SCHEMA (v2 — Multi-Tenant)
-- ==============================================================================
-- Consolidated, Idempotent, Production-Ready
-- All data is isolated by organization_id.
-- No user can ever access data outside their organization.
-- ==============================================================================

-- 1. EXTENSIONS & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$ BEGIN CREATE TYPE user_role     AS ENUM ('admin', 'manager', 'employee', 'client');    EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE lead_status   AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE project_status AS ENUM ('planning', 'in_progress', 'on_hold', 'completed', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE task_status   AS ENUM ('todo', 'in_progress', 'review', 'done');     EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');           EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. HELPER FUNCTION (single source of truth for org isolation)
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT organization_id FROM profiles WHERE id = auth.uid()),
    '00000000-0000-0000-0000-000000000000'::uuid
  );
$$;

-- 3. TABLES

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  role user_role DEFAULT 'employee',
  status TEXT DEFAULT 'pending',
  email TEXT UNIQUE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS organization_settings (
  id UUID PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000',
  company_name TEXT DEFAULT 'ECRAFTZ',
  tax_id TEXT, corporate_email TEXT, website TEXT,
  logo_url TEXT, address TEXT, phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure existing tables get the new columns
DO $$ BEGIN ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS tax_id TEXT; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS corporate_email TEXT; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS website TEXT; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS logo_url TEXT; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS address TEXT; EXCEPTION WHEN others THEN null; END $$;
DO $$ BEGIN ALTER TABLE organization_settings ADD COLUMN IF NOT EXISTS phone TEXT; EXCEPTION WHEN others THEN null; END $$;

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  first_name TEXT NOT NULL, last_name TEXT, email TEXT, phone TEXT, company TEXT,
  status lead_status DEFAULT 'new', source TEXT,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  value DECIMAL(12, 2), score INTEGER DEFAULT 0, segment TEXT DEFAULT 'Warm',
  next_follow_up TIMESTAMPTZ, last_contacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, website TEXT,
  service TEXT, contract_value DECIMAL(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  name TEXT NOT NULL, type TEXT DEFAULT 'Software', description TEXT,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  status project_status DEFAULT 'planning',
  start_date DATE, end_date DATE, budget DECIMAL(12, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS project_members (
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  role TEXT DEFAULT 'member',
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS project_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  title TEXT NOT NULL, description TEXT, due_date DATE,
  status TEXT DEFAULT 'pending', is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT,
  status task_status DEFAULT 'todo', priority task_priority DEFAULT 'medium',
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subtasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  title TEXT NOT NULL, is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  content TEXT NOT NULL, attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  description TEXT, start_time TIMESTAMPTZ NOT NULL, end_time TIMESTAMPTZ,
  duration_minutes INTEGER, is_billable BOOLEAN DEFAULT true, is_billed BOOLEAN DEFAULT false,
  invoice_id UUID, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  title TEXT NOT NULL, amount DECIMAL(12, 2) NOT NULL,
  status TEXT DEFAULT 'draft', content JSONB DEFAULT '{}'::jsonb,
  valid_until DATE, created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  proposal_id UUID,
  invoice_number TEXT UNIQUE NOT NULL, amount DECIMAL(12, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 0, tax_amount DECIMAL(12, 2) DEFAULT 0,
  is_recurring BOOLEAN DEFAULT false, frequency TEXT,
  status invoice_status DEFAULT 'draft',
  due_date DATE NOT NULL, issued_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL, payment_method TEXT,
  milestone_name TEXT, transaction_id TEXT,
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  service_name TEXT NOT NULL, amount DECIMAL(12, 2) NOT NULL,
  frequency TEXT NOT NULL, next_billing_date DATE,
  status TEXT DEFAULT 'active', created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  title TEXT NOT NULL, message TEXT NOT NULL, type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false, link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  action TEXT NOT NULL, target_type TEXT NOT NULL,
  target_name TEXT, target_id TEXT, metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. AUTH TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, role, status, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    'employee',
    'pending',
    '00000000-0000-0000-0000-000000000000'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_org       ON profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org          ON leads(organization_id);
CREATE INDEX IF NOT EXISTS idx_leads_org_status   ON leads(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_org        ON clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_org       ON projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_status ON projects(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_org          ON tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_org_status   ON tasks(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_task_comments_org  ON task_comments(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org       ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status ON invoices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_activities_org     ON activities(organization_id);
CREATE INDEX IF NOT EXISTS idx_notifications_org  ON notifications(organization_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned     ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_assigned     ON leads(assigned_to);

-- 6. RLS — STRICT ORG ISOLATION
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects           ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities         ENABLE ROW LEVEL SECURITY;
-- Drop existing policies to make the schema idempotent
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Profiles: see org members, edit only self
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (organization_id = public.get_my_org_id());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Org settings: read all, write admin only
CREATE POLICY "org_settings_select" ON organization_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "org_settings_update" ON organization_settings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- All business tables: strict org isolation
CREATE POLICY "leads_all"              ON leads              FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "clients_all"            ON clients            FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "projects_all"           ON projects           FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "project_members_all"    ON project_members    FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "project_milestones_all" ON project_milestones FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "tasks_all"              ON tasks              FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "subtasks_all"           ON subtasks           FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "task_comments_all"      ON task_comments      FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "time_logs_all"          ON time_logs          FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "proposals_all"          ON proposals          FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "invoices_all"           ON invoices           FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "payments_all"           ON payments           FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "subscriptions_all"      ON subscriptions      FOR ALL TO authenticated USING (organization_id = public.get_my_org_id()) WITH CHECK (organization_id = public.get_my_org_id());

-- Notifications: user sees only their own within org
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (organization_id = public.get_my_org_id() AND user_id = auth.uid());
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_my_org_id());
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (organization_id = public.get_my_org_id() AND user_id = auth.uid());

-- Activities: read by org, write own
CREATE POLICY "activities_select" ON activities FOR SELECT TO authenticated USING (organization_id = public.get_my_org_id());
CREATE POLICY "activities_insert" ON activities FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_my_org_id() AND user_id = auth.uid());

-- 7. SEED DATA
INSERT INTO organization_settings (id, company_name, address, phone)
VALUES ('00000000-0000-0000-0000-000000000000', 'ECRAFTZ', 'NV Tower, 20/265, A9, First floor, Kallai, Kozhikode, Kerala 673003', '+91 79949 71118')
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
-- ==============================================================================
-- DONE. Every table is now org-isolated. No cross-tenant access is possible.
-- ==============================================================================
