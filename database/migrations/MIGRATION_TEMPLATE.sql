-- ==============================================================================
-- MIGRATION TEMPLATE: [YYYYMMDDHHMMSS]_[Description]
-- Follows the Expand-Contract pattern
-- ==============================================================================

-- 1. START LOGGING
-- SELECT public.log_migration_start(20260509000001, 'example_migration');

BEGIN;

-- 2. THE MIGRATION (UP)
-- Add your non-destructive schema changes here
-- Example: CREATE TABLE IF NOT EXISTS public.test_table (...);

COMMIT;

-- 3. LOG SUCCESS
-- SELECT public.log_migration_success(20260509000001);

/*
-- ==============================================================================
-- ROLLBACK SCRIPT (DOWN)
-- Execute this if the UP migration fails or causes issues
-- ==============================================================================
BEGIN;
    -- DROP TABLE IF EXISTS public.test_table;
    -- DELETE FROM public.migration_history WHERE version = 20260509000001;
COMMIT;
*/
