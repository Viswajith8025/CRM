-- ==============================================================================
-- GLOBAL DATABASE TABLE SEARCH
-- ==============================================================================
-- Run this to find ANY table that might contain your missing data.
-- ==============================================================================

SELECT 
  schemaname, 
  relname as table_name, 
  n_live_tup as estimated_row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
