-- ==============================================================================
-- AUTOMATIC OVERDUE INVOICE AUTO-TRANSITION (FIX FOR M-9)
-- ==============================================================================
-- This RPC transitions invoices from 'sent' to 'overdue' if their due_date has passed.
-- In a production environment, this should be called by pg_cron nightly.
-- For now, it provides the database-level capability to enforce overdue statuses.

CREATE OR REPLACE FUNCTION public.update_overdue_invoices()
RETURNS INTEGER AS $$
DECLARE
    v_updated_count INTEGER := 0;
BEGIN
    UPDATE public.invoices
    SET 
        status = 'overdue',
        updated_at = NOW()
    WHERE 
        status = 'sent' 
        AND due_date < CURRENT_DATE;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    -- We log this system action to the activities table
    IF v_updated_count > 0 THEN
        INSERT INTO public.activities (
            organization_id,
            action,
            target_type,
            target_name,
            metadata,
            is_system
        )
        SELECT DISTINCT
            organization_id,
            'STATUS_CHANGE',
            'invoices',
            'Multiple Invoices',
            jsonb_build_object(
                'description', 'System auto-transitioned ' || v_updated_count || ' invoices to overdue status based on due dates.'
            ),
            true
        FROM public.invoices
        WHERE status = 'overdue' AND updated_at >= NOW() - INTERVAL '1 minute';
    END IF;

    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
