-- RPC & SCHEMA DIAGNOSTIC
-- Run this in Supabase SQL Editor to see what is missing

SELECT 
    p.proname as function_name,
    pg_get_function_arguments(p.oid) as args,
    pg_get_function_result(p.oid) as result_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('process_overdue_invoices', 'process_stale_leads');

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('automation_logs', 'automation_queue', 'notifications');
