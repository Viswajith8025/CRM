-- ==============================================================================
-- CLIENT FILE VAULT MIGRATION
-- Organize documents by folders and link them to clients
-- ==============================================================================

-- 1. ADD FOLDER & CLIENT LINK TO DOCUMENTS
ALTER TABLE documents ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT 'Assets';
ALTER TABLE documents ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE CASCADE;

-- 2. UPDATE EXISTING RECORDS (optional cleanup)
-- Update folder based on related_entity_type if possible
UPDATE documents SET folder = 'Invoices' WHERE related_entity_type = 'invoice';
UPDATE documents SET folder = 'Projects' WHERE related_entity_type = 'project';
UPDATE documents SET folder = 'Tasks' WHERE related_entity_type = 'task';

-- 3. ENSURE RLS POLICIES COVER CLIENT PORTAL ACCESS
-- Clients can see documents linked to their own client_id
DROP POLICY IF EXISTS "clients_view_vault" ON documents;
CREATE POLICY "clients_view_vault" ON documents FOR SELECT TO authenticated
  USING (
    organization_id = public.get_my_org_id() 
    AND (
      -- Admin/Employee can see everything in org
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'employee'))
      OR 
      -- Client can only see documents linked to them
      client_id IN (SELECT id FROM clients WHERE user_id = auth.uid())
    )
  );
