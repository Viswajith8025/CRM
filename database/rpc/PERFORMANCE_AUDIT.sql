-- ==============================================================================
-- ENTERPRISE PERFORMANCE & INDEX AUDIT
-- Analyzes query efficiency and identifies missing performance optimizations
-- ==============================================================================

-- 1. CRITICAL SEARCH INDEXES
-- Ensures Global Search and Filtering are O(log n)
CREATE INDEX IF NOT EXISTS idx_leads_org_created ON public.leads (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_org_project_status ON public.tasks (organization_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_invoices_org_status_issued ON public.invoices (organization_id, status, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_task ON public.task_time_logs (user_id, task_id);

-- 2. PARTIAL INDEXES FOR COMMON FILTERS
-- Optimizes "Overdue" queries which are the most common executive performance hit
CREATE INDEX IF NOT EXISTS idx_invoices_overdue_partial ON public.invoices (organization_id, amount) 
WHERE status = 'overdue' OR status = 'sent';

-- 3. SLOW QUERY DETECTOR (requires pg_stat_statements)
-- This view helps identify which queries are eating up the most CPU/IO
CREATE OR REPLACE VIEW public.performance_summary AS
SELECT 
    substring(query, 1, 100) as query_preview,
    calls,
    total_exec_time / 1000 as total_exec_seconds,
    min_exec_time,
    max_exec_time,
    mean_exec_time,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- 4. VACUUM & ANALYZE
-- Run this after bulk loading to ensure the query planner has fresh statistics
-- ANALYZE public.leads;
-- ANALYZE public.tasks;
-- ANALYZE public.invoices;

-- 5. FUNCTION PERFORMANCE MONITOR
-- Wraps execution in timing for debugging complex RPCs
CREATE OR REPLACE FUNCTION public.debug_perf_trace(p_function_name TEXT, p_params JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_result JSONB;
BEGIN
    v_start := clock_timestamp();
    
    -- Execute dynamic function call (simplified example)
    EXECUTE format('SELECT %I(%L)', p_function_name, p_params) INTO v_result;
    
    v_end := clock_timestamp();
    
    RETURN jsonb_build_object(
        'result', v_result,
        'execution_ms', extract(milliseconds from (v_end - v_start))
    );
END;
$$;
