-- ==============================================================================
-- ECRAFTZ STORAGE & DOCUMENT MANAGEMENT
-- ==============================================================================

-- 1. METADATA TABLE
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  
  -- Related entities (polymorphic-ish behavior)
  related_entity_id UUID,
  related_entity_type TEXT NOT NULL, -- 'task', 'invoice', 'project', 'client', 'other'
  
  -- File metadata
  name TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT,
  file_path TEXT NOT NULL, -- Path within bucket
  bucket_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  
  -- Versioning & Organization
  version_number INTEGER DEFAULT 1,
  folder TEXT DEFAULT 'Assets',
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ENABLE RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 3. POLICIES FOR DOCUMENTS TABLE
DROP POLICY IF EXISTS "documents_org_isolation" ON documents;
CREATE POLICY "documents_org_isolation" ON documents
  FOR ALL TO authenticated
  USING (organization_id = public.get_my_org_id())
  WITH CHECK (organization_id = public.get_my_org_id());

-- 4. STORAGE BUCKETS (Instructions & RLS)
-- Note: Buckets must be created in the Supabase UI or via API
-- Buckets to create: 'task-attachments', 'invoices', 'documents'

-- Allow users to see files in their own organization folder within buckets
-- We use a folder structure: /organization_id/entity_id/filename

DROP POLICY IF EXISTS "Storage Select" ON storage.objects;
CREATE POLICY "Storage Select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('task-attachments', 'invoices', 'documents') 
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text);

DROP POLICY IF EXISTS "Storage Insert" ON storage.objects;
CREATE POLICY "Storage Insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('task-attachments', 'invoices', 'documents') 
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text);

DROP POLICY IF EXISTS "Storage Update" ON storage.objects;
CREATE POLICY "Storage Update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('task-attachments', 'invoices', 'documents') 
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text);

-- 5. ACCESS TRACKING RPC
CREATE OR REPLACE FUNCTION track_document_access(p_doc_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE documents 
  SET updated_at = NOW() 
  WHERE id = p_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';

DROP POLICY IF EXISTS "Storage Delete" ON storage.objects;
CREATE POLICY "Storage Delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('task-attachments', 'invoices', 'documents') 
  AND (storage.foldername(name))[1] = public.get_my_org_id()::text);
