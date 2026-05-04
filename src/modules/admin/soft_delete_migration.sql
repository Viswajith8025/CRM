-- ==============================================================================
-- SOFT DELETE SYSTEM MIGRATION
-- ==============================================================================

-- 1. ADD DELETED_AT TO CORE TABLES
ALTER TABLE leads    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE clients  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. UPDATE RLS POLICIES TO FILTER OUT DELETED RECORDS BY DEFAULT
-- We need to replace the existing policies with ones that check for deleted_at IS NULL.

-- Leads
DROP POLICY IF EXISTS "leads_all" ON leads;
CREATE POLICY "leads_all" ON leads FOR ALL TO authenticated 
USING (organization_id = public.get_my_org_id() AND deleted_at IS NULL) 
WITH CHECK (organization_id = public.get_my_org_id());

-- Clients
DROP POLICY IF EXISTS "clients_all" ON clients;
CREATE POLICY "clients_all" ON clients FOR ALL TO authenticated 
USING (organization_id = public.get_my_org_id() AND deleted_at IS NULL) 
WITH CHECK (organization_id = public.get_my_org_id());

-- Projects
DROP POLICY IF EXISTS "projects_all" ON projects;
CREATE POLICY "projects_all" ON projects FOR ALL TO authenticated 
USING (organization_id = public.get_my_org_id() AND deleted_at IS NULL) 
WITH CHECK (organization_id = public.get_my_org_id());

-- Tasks
DROP POLICY IF EXISTS "tasks_all" ON tasks;
CREATE POLICY "tasks_all" ON tasks FOR ALL TO authenticated 
USING (organization_id = public.get_my_org_id() AND deleted_at IS NULL) 
WITH CHECK (organization_id = public.get_my_org_id());

-- Invoices
DROP POLICY IF EXISTS "invoices_all" ON invoices;
CREATE POLICY "invoices_all" ON invoices FOR ALL TO authenticated 
USING (organization_id = public.get_my_org_id() AND deleted_at IS NULL) 
WITH CHECK (organization_id = public.get_my_org_id());

-- 3. CREATE A SPECIAL "RESTORE" POLICY FOR ADMINS (Optional)
-- This allows admins to see deleted records if they explicitly query for them.
-- For now, the 'USING' clause above will hide them from everyone including admins.
-- To allow admins to restore, we need a separate policy or update the existing one.

CREATE POLICY "leads_restore" ON leads FOR UPDATE TO authenticated 
USING (organization_id = public.get_my_org_id()) 
WITH CHECK (organization_id = public.get_my_org_id());

-- Note: In a production environment, we'd add 'deleted_at IS NULL' to almost all SELECT policies
-- but keep it off for UPDATE/DELETE to allow administrative restoration.
