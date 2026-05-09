-- ==============================================================================
-- PROJECT PROFITABILITY & FINANCIAL TRACKING MIGRATION
-- Revenue, Labor Costs, and Project Expenses
-- ==============================================================================

-- 1. ADD HOURLY RATE TO PROFILES (for labor cost calculation)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS hourly_rate DECIMAL(10, 2) DEFAULT 0.00;

-- 2. CREATE PROJECT EXPENSES TABLE
CREATE TABLE IF NOT EXISTS project_expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, -- Who recorded it
  amount DECIMAL(12, 2) NOT NULL,
  category VARCHAR(50) DEFAULT 'other', -- 'software', 'travel', 'outsourcing', 'hardware'
  description TEXT,
  expense_date DATE DEFAULT CURRENT_DATE,
  attachment_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE project_expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON project_expenses;
CREATE POLICY "expenses_select" ON project_expenses FOR SELECT TO authenticated 
  USING (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "expenses_insert" ON project_expenses;
CREATE POLICY "expenses_insert" ON project_expenses FOR INSERT TO authenticated 
  WITH CHECK (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "expenses_delete" ON project_expenses;
CREATE POLICY "expenses_delete" ON project_expenses FOR DELETE TO authenticated 
  USING (organization_id = public.get_my_org_id() AND (
    auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin'))
  ));

-- 4. VIEW FOR PROFITABILITY (Optional, but useful for complex reporting)
-- We'll mostly calculate this in the store for real-time reactivity.
