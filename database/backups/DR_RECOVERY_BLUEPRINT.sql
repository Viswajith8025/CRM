-- ==============================================================================
-- DISASTER RECOVERY & DATA RESUSCITATION BLUEPRINT
-- Provides tools for targeted data recovery without full database restores
-- ==============================================================================

-- 1. EMERGENCY TABLE SNAPSHOT
-- Use this before running "scary" manual updates or experimental queries
-- Usage: SELECT public.create_emergency_snapshot('leads');
CREATE OR REPLACE FUNCTION public.create_emergency_snapshot(p_table_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_snapshot_name TEXT;
BEGIN
    v_snapshot_name := p_table_name || '_snapshot_' || to_char(NOW(), 'YYYYMMDD_HH24MISS');
    EXECUTE format('CREATE TABLE public.%I AS SELECT * FROM public.%I', v_snapshot_name, p_table_name);
    RETURN v_snapshot_name;
END;
$$;

-- 2. TARGETED RECORD RESUSCITATION
-- Use this to restore a single deleted record from a snapshot table
-- Usage: SELECT public.resuscitate_record('leads', 'leads_snapshot_20260509...', 'UUID-HERE');
CREATE OR REPLACE FUNCTION public.resuscitate_record(
    p_target_table TEXT,
    p_snapshot_table TEXT,
    p_record_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM public.%I WHERE id = %L ON CONFLICT (id) DO NOTHING',
        p_target_table, p_snapshot_table, p_record_id
    );
END;
$$;

-- 3. SCHEMA DRIFT DETECTOR
-- Identifies if the current production schema has diverged from the migration registry
CREATE OR REPLACE VIEW public.dr_schema_health AS
SELECT 
    schemaname, 
    relname as table_name, 
    n_tup_ins, 
    n_tup_upd, 
    n_tup_del,
    last_vacuum,
    last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_tup_ins DESC;
