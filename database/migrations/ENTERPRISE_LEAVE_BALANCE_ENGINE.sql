-- ==============================================================================
-- ENTERPRISE LEAVE BALANCE ENGINE (C-1 FIX)
-- ==============================================================================
-- This schema introduces the leave_balances table and the trigger to automatically
-- deduct or restore balances when a leave request is approved, rejected, or cancelled.

-- 1. Create the leave_balances table
CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organization_settings(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    total_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
    used_days NUMERIC(5, 1) NOT NULL DEFAULT 0,
    remaining_days NUMERIC(5, 1) GENERATED ALWAYS AS (total_days - used_days) STORED,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, leave_type_id, year)
);

-- 2. Add RLS
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own leave balances" ON public.leave_balances;
CREATE POLICY "Users can view own leave balances" ON public.leave_balances
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR 
           EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'manager')));

-- 3. Create the Deduction Trigger
CREATE OR REPLACE FUNCTION public.process_leave_balance_deduction()
RETURNS TRIGGER AS $$
DECLARE
    v_days NUMERIC(5,1);
    v_year INTEGER;
    v_balance_record public.leave_balances%ROWTYPE;
BEGIN
    -- Calculate requested days (simple difference for now, ignoring weekends/holidays)
    v_days := (NEW.end_date - NEW.start_date) + 1;
    v_year := EXTRACT(YEAR FROM NEW.start_date);

    -- Only process transitions to 'approved'
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        
        -- Check if balance exists
        SELECT * INTO v_balance_record 
        FROM public.leave_balances 
        WHERE user_id = NEW.user_id AND leave_type_id = NEW.leave_type_id AND year = v_year;
        
        IF NOT FOUND THEN
            -- If no balance record, we cannot approve! Or we auto-initialize?
            -- Enterprise policy: Reject or raise exception if no balance allocation.
            RAISE EXCEPTION 'No leave balance allocation found for this user and leave type in year %', v_year;
        END IF;

        IF v_balance_record.remaining_days < v_days THEN
            RAISE EXCEPTION 'Insufficient leave balance. Requested: %, Remaining: %', v_days, v_balance_record.remaining_days;
        END IF;

        -- Deduct
        UPDATE public.leave_balances
        SET used_days = used_days + v_days,
            updated_at = NOW()
        WHERE id = v_balance_record.id;
        
    -- Process transitions FROM 'approved' to something else (e.g., cancelled, rejected)
    ELSIF OLD.status = 'approved' AND NEW.status IN ('cancelled', 'rejected') THEN
        -- Restore
        UPDATE public.leave_balances
        SET used_days = used_days - v_days,
            updated_at = NOW()
        WHERE user_id = NEW.user_id AND leave_type_id = NEW.leave_type_id AND year = v_year;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply Trigger
DROP TRIGGER IF EXISTS trigger_leave_balance_deduction ON public.leave_requests;
CREATE TRIGGER trigger_leave_balance_deduction
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW
    WHEN (NEW.status IS DISTINCT FROM OLD.status)
    EXECUTE FUNCTION public.process_leave_balance_deduction();

-- Refresh cache
NOTIFY pgrst, 'reload schema';
