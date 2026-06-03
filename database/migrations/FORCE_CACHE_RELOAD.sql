-- ==============================================================================
-- SAFE: DEDUPLICATE LEAVE TYPES + FORCE SCHEMA CACHE RELOAD
-- ==============================================================================

-- Step 1: Re-point leave_requests to the canonical (oldest) leave type
-- so we can safely delete the duplicates without FK violations.
UPDATE public.leave_requests lr
SET leave_type_id = canonical.id
FROM (
  SELECT DISTINCT ON (name) id, name
  FROM public.leave_types
  ORDER BY name, created_at ASC
) AS canonical
JOIN public.leave_types dup ON dup.name = canonical.name AND dup.id != canonical.id
WHERE lr.leave_type_id = dup.id;

-- Step 2: Now safely delete the duplicates (no more FK references)
DELETE FROM public.leave_types
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM public.leave_types
  ORDER BY name, created_at ASC
);

-- Step 3: Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- Step 4: Verify everything
SELECT 'leave_requests' AS table_name, COUNT(*) AS row_count FROM public.leave_requests
UNION ALL
SELECT 'leave_types', COUNT(*) FROM public.leave_types;
