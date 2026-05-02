-- ==============================================================================
-- DEEP DATABASE AUDIT (All Schemas)
-- ==============================================================================
-- Run this to find if your data exists ANYWHERE in the database.
-- ==============================================================================

SELECT 
  schemaname, 
  relname as table_name, 
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- Specifically check the current user to see who the database thinks you are
SELECT auth.uid() as current_user_id;

-- Check if RLS is actually disabled as expected
SELECT relname, relrowsecurity 
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
AND relname IN ('leads', 'tasks', 'invoices', 'projects');
