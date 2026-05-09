-- ==============================================================================
-- ENTERPRISE STORAGE HARDENING & QUOTA MANAGEMENT
-- Implements Org-Isolation, Usage Tracking, and Strict RLS for Supabase Storage
-- ==============================================================================

-- 1. STORAGE USAGE TRACKING
CREATE TABLE IF NOT EXISTS public.organization_storage_stats (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    current_usage_bytes BIGINT DEFAULT 0,
    max_quota_bytes BIGINT DEFAULT 1073741824, -- 1GB Default
    last_updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Initialize stats for existing orgs
INSERT INTO public.organization_storage_stats (organization_id)
SELECT id FROM public.organizations
ON CONFLICT DO NOTHING;

-- 2. ATTACHMENTS REGISTRY
-- Links physical files in Storage to database records
CREATE TABLE IF NOT EXISTS public.attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    bucket_id TEXT NOT NULL,
    file_path TEXT NOT NULL, -- Format: {org_id}/{entity_type}/{filename}
    file_name TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    content_type TEXT,
    uploaded_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on attachments
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_org_isolation" ON public.attachments
FOR ALL TO authenticated USING (organization_id = public.get_my_org_id());

-- 3. QUOTA ENFORCEMENT TRIGGER
CREATE OR REPLACE FUNCTION public.fn_update_storage_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        -- Check Quota Before Allowing
        IF (SELECT current_usage_bytes + NEW.file_size > max_quota_bytes 
            FROM public.organization_storage_stats 
            WHERE organization_id = NEW.organization_id) THEN
            RAISE EXCEPTION 'STORAGE_QUOTA_EXCEEDED: Organization has reached its storage limit.';
        END IF;

        UPDATE public.organization_storage_stats 
        SET current_usage_bytes = current_usage_bytes + NEW.file_size,
            last_updated_at = NOW()
        WHERE organization_id = NEW.organization_id;
    
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.organization_storage_stats 
        SET current_usage_bytes = GREATEST(0, current_usage_bytes - OLD.file_size),
            last_updated_at = NOW()
        WHERE organization_id = OLD.organization_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_attachments_usage_sync
AFTER INSERT OR DELETE ON public.attachments
FOR EACH ROW EXECUTE FUNCTION public.fn_update_storage_usage();

-- 4. SUPABASE STORAGE POLICIES (Conceptual - run in SQL editor)
-- Note: Replace 'documents' with your actual bucket name
/*
-- SELECT: Only allow access to files in your own organization folder
CREATE POLICY "Storage Org Isolation Select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'documents' AND (storage.foldername(name))[1] = public.get_my_org_id()::text);

-- INSERT: Only allow uploads to your own organization folder and restrict file types
CREATE POLICY "Storage Org Isolation Insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'documents' AND 
    (storage.foldername(name))[1] = public.get_my_org_id()::text AND
    (LOWER(storage.extension(name)) IN ('jpg', 'jpeg', 'png', 'pdf', 'docx', 'xlsx', 'csv', 'zip'))
);
*/
