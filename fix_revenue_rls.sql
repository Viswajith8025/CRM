-- 1. ADD ORGANIZATION_ID TO ALL CORE TABLES IF MISSING
DO $$ 
BEGIN 
    -- List of tables to check
    FOR tab IN 
        SELECT unnest(ARRAY['leads', 'clients', 'projects', 'tasks', 'invoices', 'payments', 'time_logs'])
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = tab AND column_name = 'organization_id'
        ) THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL', tab);
        END IF;
    END LOOP;
END $$;

-- 2. BACKFILL EXISTING DATA TO DEFAULT ORGANIZATION
-- (Assumes '00000000-0000-0000-0000-000000000000' exists as fixed in previous turn)
UPDATE leads SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE clients SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE projects SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE tasks SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE invoices SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE payments SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
UPDATE time_logs SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;

-- 3. UPDATE RLS POLICIES TO BE ORGANIZATION-BASED
-- We drop the old "manage own" policies and create "manage organization" policies

-- INVOICES
DROP POLICY IF EXISTS "Users can manage their own invoices" ON invoices;
CREATE POLICY "Users can manage organization invoices" ON invoices
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- PROJECTS
DROP POLICY IF EXISTS "Users can manage their own projects" ON projects;
CREATE POLICY "Users can manage organization projects" ON projects
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- CLIENTS
DROP POLICY IF EXISTS "Users can manage their own clients" ON clients;
CREATE POLICY "Users can manage organization clients" ON clients
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- PAYMENTS
DROP POLICY IF EXISTS "Users can manage their own payments" ON payments;
CREATE POLICY "Users can manage organization payments" ON payments
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- TASKS
DROP POLICY IF EXISTS "Users can manage their own tasks" ON tasks;
CREATE POLICY "Users can manage organization tasks" ON tasks
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

-- LEADS (Fixing policy here too to be safe)
DROP POLICY IF EXISTS "Users can manage their own leads" ON leads;
CREATE POLICY "Users can manage organization leads" ON leads
FOR ALL TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);
