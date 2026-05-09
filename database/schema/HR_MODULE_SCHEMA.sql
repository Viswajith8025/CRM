-- ==============================================================================
-- HR MODULE SCHEMA: Attendance, Leaves, and Payroll
-- ==============================================================================

-- 1. TABLES

-- Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  status TEXT DEFAULT 'present', -- present, late, absent
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  leave_type TEXT NOT NULL, -- sick, vacation, personal, etc.
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected
  approved_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payroll Table
CREATE TABLE IF NOT EXISTS payroll (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  basic_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  allowances DECIMAL(12, 2) DEFAULT 0,
  deductions DECIMAL(12, 2) DEFAULT 0,
  net_pay DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft', -- draft, paid
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_org  ON attendance(organization_id);
CREATE INDEX IF NOT EXISTS idx_leaves_user     ON leave_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_org      ON leave_requests(organization_id);
CREATE INDEX IF NOT EXISTS idx_payroll_user    ON payroll(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_org     ON payroll(organization_id);

-- 3. RLS - SECURITY
ALTER TABLE attendance     ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll        ENABLE ROW LEVEL SECURITY;

-- Attendance Policies
DROP POLICY IF EXISTS "attendance_select" ON attendance;
CREATE POLICY "attendance_select" ON attendance FOR SELECT TO authenticated 
USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "attendance_insert" ON attendance;
CREATE POLICY "attendance_insert" ON attendance FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid() AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "attendance_update" ON attendance;
CREATE POLICY "attendance_update" ON attendance FOR UPDATE TO authenticated 
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Leave Request Policies
DROP POLICY IF EXISTS "leaves_select" ON leave_requests;
CREATE POLICY "leaves_select" ON leave_requests FOR SELECT TO authenticated 
USING (organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "leaves_insert" ON leave_requests;
CREATE POLICY "leaves_insert" ON leave_requests FOR INSERT TO authenticated 
WITH CHECK (user_id = auth.uid() AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "leaves_update" ON leave_requests;
CREATE POLICY "leaves_update" ON leave_requests FOR UPDATE TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- Payroll Policies
DROP POLICY IF EXISTS "payroll_select" ON payroll;
CREATE POLICY "payroll_select" ON payroll FOR SELECT TO authenticated 
USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

DROP POLICY IF EXISTS "payroll_manager_all" ON payroll;
CREATE POLICY "payroll_manager_all" ON payroll FOR ALL TO authenticated 
USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')));

-- 4. HELPER TRIGGER FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_attendance_updated_at ON attendance;
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_leaves_updated_at ON leave_requests;
CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON leave_requests FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

DROP TRIGGER IF EXISTS update_payroll_updated_at ON payroll;
CREATE TRIGGER update_payroll_updated_at BEFORE UPDATE ON payroll FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

NOTIFY pgrst, 'reload schema';
