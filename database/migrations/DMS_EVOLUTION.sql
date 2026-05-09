-- ==============================================================================
-- ENTERPRISE DOCUMENT MANAGEMENT SYSTEM (DMS) EVOLUTION
-- Features: Versioning, HR Support, Improved Metadata, Unified Storage Policies
-- ==============================================================================

-- 1. EXTEND documents TABLE
ALTER TABLE public.documents 
  ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[],
  ADD COLUMN IF NOT EXISTS checksum TEXT, -- For integrity validation
  ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ;

-- 2. CREATE document_versions TABLE
CREATE TABLE IF NOT EXISTS public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  change_notes TEXT,
  metadata JSONB DEFAULT '{}'
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_id ON public.document_versions(document_id);
CREATE INDEX IF NOT EXISTS idx_documents_related ON public.documents(related_entity_id, related_entity_type);
CREATE INDEX IF NOT EXISTS idx_documents_org ON public.documents(organization_id);

-- 3. STORAGE BUCKET: HR-DOCUMENTS
-- Note: This bucket should be created with 'Public: false' in the UI
-- Only admins and managers can access HR documents.
DROP POLICY IF EXISTS "HR Storage Access" ON storage.objects;
CREATE POLICY "HR Storage Access" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'hr-documents' 
    AND (storage.foldername(name))[1] = public.get_my_org_id()::text
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager')
      )
      OR (storage.foldername(name))[2] = auth.uid()::text -- Employees can see their own HR folder
    )
  );

-- 4. DMS POLICIES (documents table)
-- Restrict HR documents in the table too
DROP POLICY IF EXISTS "dms_hr_isolation" ON public.documents;
CREATE POLICY "dms_hr_isolation" ON public.documents
  FOR ALL TO authenticated
  USING (
    organization_id = public.get_my_org_id()
    AND (
      related_entity_type != 'hr'
      OR (
        related_entity_type = 'hr' 
        AND (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin', 'manager'))
          OR user_id = auth.uid() -- Employee's own records
        )
      )
    )
  );

-- 5. FUNCTION: Increment document access count/time
CREATE OR REPLACE FUNCTION public.track_document_access(p_doc_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.documents 
  SET last_accessed_at = now() 
  WHERE id = p_doc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger for version tracking (Automatic backup of old version before update)
CREATE OR REPLACE FUNCTION public.handle_document_versioning()
RETURNS TRIGGER AS $$
BEGIN
  -- If we are updating the file path or name, we should move current to versions table
  IF OLD.file_path IS DISTINCT FROM NEW.file_path THEN
    INSERT INTO public.document_versions (
      document_id, version_number, file_path, file_url, size_bytes, created_at, created_by
    ) VALUES (
      OLD.id, OLD.version_number, OLD.file_path, OLD.file_url, OLD.size_bytes, OLD.updated_at, OLD.user_id
    );
    NEW.version_number := OLD.version_number + 1;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_document_versioning ON public.documents;
CREATE TRIGGER tr_document_versioning
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_document_versioning();

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.track_document_access(UUID) TO authenticated;

-- ==============================================================================
-- DONE
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
