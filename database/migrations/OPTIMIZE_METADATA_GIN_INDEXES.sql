-- ==============================================================================
-- OPTIMIZE METADATA GIN INDEXES
-- Resolves Medium Issue: Orphaned Metadata Cleanup & Query Efficiency
-- ==============================================================================

-- Ensure the pg_trgm extension is available for text-based GIN indexing
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN indexes on columns that frequently store stringified JSON metadata
-- This drastically improves the performance of LIKE '%"key":"value"%' queries
-- allowing the backend to efficiently search through metadata fallbacks without full table scans.

-- 1. Projects Description (often stores JSON metadata fallback)
CREATE INDEX IF NOT EXISTS idx_projects_description_gin 
ON public.projects USING GIN (description gin_trgm_ops);

-- 2. Clients Address (stores custom form fields/metadata fallback)
CREATE INDEX IF NOT EXISTS idx_clients_address_gin 
ON public.clients USING GIN (address gin_trgm_ops);

-- 3. Tasks Remarks/Description 
CREATE INDEX IF NOT EXISTS idx_tasks_description_gin 
ON public.tasks USING GIN (description gin_trgm_ops);

-- 4. Daily Tasks Remarks
CREATE INDEX IF NOT EXISTS idx_daily_tasks_remarks_gin 
ON public.daily_tasks USING GIN (remarks gin_trgm_ops);

NOTIFY pgrst, 'reload schema';
