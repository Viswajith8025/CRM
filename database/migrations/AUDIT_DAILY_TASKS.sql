-- ==============================================================================
-- ADD AUDIT TRIGGER TO DAILY TASKS (M-2 FIX)
-- ==============================================================================
-- Ensures self-assigned tasks are tracked immutably in the audit_logs table.

DROP TRIGGER IF EXISTS trigger_audit_daily_tasks ON public.daily_tasks;

CREATE TRIGGER trigger_audit_daily_tasks
    AFTER INSERT OR UPDATE OR DELETE ON public.daily_tasks
    FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

-- Refresh cache
NOTIFY pgrst, 'reload schema';
