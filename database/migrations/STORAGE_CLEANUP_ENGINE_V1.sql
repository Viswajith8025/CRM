-- ==============================================================================
-- STORAGE CLEANUP ENGINE (PHASE 1)
-- ==============================================================================
-- Identifies orphaned files in Supabase Storage that are no longer linked 
-- to any operational records (Profiles, Tasks, etc.).
-- ==============================================================================

-- 1. Create a unified view of all legitimate files in the database
CREATE OR REPLACE VIEW public.valid_storage_references AS
SELECT 
    avatar_url AS file_path 
FROM public.profiles 
WHERE avatar_url IS NOT NULL

UNION

SELECT 
    file_path 
FROM public.documents
WHERE file_path IS NOT NULL;

-- 2. Create the Sweeper RPC to find Storage Orphans
-- Note: Requires `storage.objects` to be accessible. If this throws a permission error
-- during execution due to Supabase restrictions on the storage schema, 
-- this logic must be moved to an Edge Function using the Supabase Admin SDK.
CREATE OR REPLACE FUNCTION public.get_orphan_storage_objects()
RETURNS TABLE(bucket_id text, name text, created_at timestamptz) 
LANGUAGE sql 
SECURITY DEFINER 
AS $$
  SELECT 
      o.bucket_id, 
      o.name, 
      o.created_at
  FROM storage.objects o
  LEFT JOIN public.valid_storage_references v 
      ON v.file_path LIKE '%' || o.name
  WHERE v.file_path IS NULL 
    -- Buffer zone: Only flag files older than 24 hours to prevent deleting 
    -- files that are currently in the middle of being uploaded.
    AND o.created_at < NOW() - INTERVAL '24 hours'
    -- Only clean up specific buckets
    AND o.bucket_id IN ('avatars', 'attachments', 'vault');
$$;

-- Notify schema refresh
NOTIFY pgrst, 'reload schema';
