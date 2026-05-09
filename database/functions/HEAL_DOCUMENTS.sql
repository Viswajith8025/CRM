-- ==============================================================================
-- HEAL DOCUMENTS TABLE SCHEMA
-- ==============================================================================
-- This script ensures the 'documents' table matches the DocumentRecord interface.
-- Run this in the Supabase SQL Editor.

-- 1. Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes BIGINT NOT NULL,
    bucket_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    related_entity_id UUID,
    related_entity_type TEXT NOT NULL CHECK (related_entity_type IN ('task', 'invoice', 'project', 'client', 'other')),
    organization_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Add missing columns if table exists but is outdated
DO $$ 
BEGIN 
    -- Handle the "title" vs "name" legacy conflict
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='title') THEN
        -- If name doesn't exist, rename title to name
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='name') THEN
            ALTER TABLE public.documents RENAME COLUMN title TO name;
        ELSE
            -- If both exist, just make title nullable so it doesn't block inserts
            ALTER TABLE public.documents ALTER COLUMN title DROP NOT NULL;
        END IF;
    END IF;

    -- Add name if missing (in case title didn't exist to be renamed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='name') THEN
        ALTER TABLE public.documents ADD COLUMN name TEXT;
        UPDATE public.documents SET name = 'unnamed' WHERE name IS NULL;
        ALTER TABLE public.documents ALTER COLUMN name SET NOT NULL;
    END IF;

    -- Add file_url if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='file_url') THEN
        ALTER TABLE public.documents ADD COLUMN file_url TEXT;
        -- If there was a legacy 'url' column, backfill it
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='url') THEN
            UPDATE public.documents SET file_url = url WHERE file_url IS NULL;
        END IF;
        UPDATE public.documents SET file_url = '' WHERE file_url IS NULL;
        ALTER TABLE public.documents ALTER COLUMN file_url SET NOT NULL;
    END IF;

    -- Add size_bytes if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='size_bytes') THEN
        ALTER TABLE public.documents ADD COLUMN size_bytes BIGINT DEFAULT 0;
        UPDATE public.documents SET size_bytes = 0 WHERE size_bytes IS NULL;
        ALTER TABLE public.documents ALTER COLUMN size_bytes SET NOT NULL;
    END IF;

    -- Add bucket_name if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='bucket_name') THEN
        ALTER TABLE public.documents ADD COLUMN bucket_name TEXT DEFAULT 'documents';
        UPDATE public.documents SET bucket_name = 'documents' WHERE bucket_name IS NULL;
        ALTER TABLE public.documents ALTER COLUMN bucket_name SET NOT NULL;
    END IF;

    -- Add file_path if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='file_path') THEN
        ALTER TABLE public.documents ADD COLUMN file_path TEXT DEFAULT '';
        UPDATE public.documents SET file_path = '' WHERE file_path IS NULL;
        ALTER TABLE public.documents ALTER COLUMN file_path SET NOT NULL;
    END IF;

    -- Add mime_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='mime_type') THEN
        ALTER TABLE public.documents ADD COLUMN mime_type TEXT DEFAULT 'application/octet-stream';
        UPDATE public.documents SET mime_type = 'application/octet-stream' WHERE mime_type IS NULL;
        ALTER TABLE public.documents ALTER COLUMN mime_type SET NOT NULL;
    END IF;

    -- Add related_entity_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='related_entity_id') THEN
        ALTER TABLE public.documents ADD COLUMN related_entity_id UUID;
    END IF;

    -- Add related_entity_type if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='related_entity_type') THEN
        ALTER TABLE public.documents ADD COLUMN related_entity_type TEXT DEFAULT 'other';
        UPDATE public.documents SET related_entity_type = 'other' WHERE related_entity_type IS NULL;
        ALTER TABLE public.documents ALTER COLUMN related_entity_type SET NOT NULL;
    END IF;

    -- Add organization_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='organization_id') THEN
        ALTER TABLE public.documents ADD COLUMN organization_id UUID DEFAULT '00000000-0000-0000-0000-000000000000';
        UPDATE public.documents SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;
        ALTER TABLE public.documents ALTER COLUMN organization_id SET NOT NULL;
    END IF;

    -- Add user_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='documents' AND column_name='user_id') THEN
        ALTER TABLE public.documents ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 3. Data Alignment (Healing organization_id)
-- Ensure documents match the organization of their parent entities

-- 3.1. Align with Tasks
UPDATE public.documents d
SET organization_id = t.organization_id
FROM public.tasks t
WHERE d.related_entity_id = t.id 
AND d.related_entity_type = 'task'
AND d.organization_id != t.organization_id;

-- 3.2. Align with Projects
UPDATE public.documents d
SET organization_id = p.organization_id
FROM public.projects p
WHERE d.related_entity_id = p.id 
AND d.related_entity_type = 'project'
AND d.organization_id != p.organization_id;

-- 3.3. Align with Clients
UPDATE public.documents d
SET organization_id = c.organization_id
FROM public.clients c
WHERE d.related_entity_id = c.id 
AND d.related_entity_type = 'client'
AND d.organization_id != c.organization_id;

-- 3.4. Align with Invoices
UPDATE public.documents d
SET organization_id = i.organization_id
FROM public.invoices i
WHERE d.related_entity_id = i.id 
AND d.related_entity_type = 'invoice'
AND d.organization_id != i.organization_id;

-- 4. Set up Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_updated_at ON public.documents;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON public.documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_related_entity ON public.documents(related_entity_id, related_entity_type);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);

-- 6. Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 7. Create Policies (Idempotent)
DROP POLICY IF EXISTS "documents_all" ON public.documents;
CREATE POLICY "documents_all" ON public.documents
    FOR ALL TO authenticated
    USING (organization_id = public.get_my_org_id())
    WITH CHECK (organization_id = public.get_my_org_id());

-- 8. Refresh Schema Cache (CRITICAL)
NOTIFY pgrst, 'reload schema';
COMMIT;
