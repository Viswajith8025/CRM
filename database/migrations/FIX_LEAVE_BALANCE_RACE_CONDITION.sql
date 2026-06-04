-- ==============================================================================
-- CB-03 FIX: LEAVE BALANCE RACE CONDITION — FOR UPDATE ROW LOCK
-- Replaces process_leave_balance_deduction() with a serialized version.
-- Adds SELECT ... FOR UPDATE to prevent two concurrent approvals from
-- double-deducting the same employee's leave balance.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.process_leave_balance_deduction()
RETURNS TRIGGER AS $$
DECLARE
    v_days NUMERIC(5,1);
    v_year INTEGER;
    v_balance_id UUID;
    v_used_days  NUMERIC(5,1);
    v_total_days NUMERIC(5,1);
    v_remaining  NUMERIC(5,1);
BEGIN
    -- Calculate requested days (inclusive: 3-day leave from Mon to Wed = 3 days)
    v_days := (NEW.end_date - NEW.start_date) + 1;
    v_year := EXTRACT(YEAR FROM NEW.start_date);

    -- ──────────────────────────────────────────────────────────────────────────
    -- APPROVE PATH: transition INTO 'approved'
    -- ──────────────────────────────────────────────────────────────────────────
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN

        -- SELECT ... FOR UPDATE acquires a row-level lock.
        -- If two concurrent transactions try to approve for the same user,
        -- the second will WAIT here until the first commits, preventing double-deduction.
        SELECT id, used_days, total_days, (total_days - used_days)
        INTO v_balance_id, v_used_days, v_total_days, v_remaining
        FROM public.leave_balances
        WHERE user_id        = NEW.user_id
          AND leave_type_id  = NEW.leave_type_id
          AND year           = v_year
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'No leave balance allocation found for user % and leave type % in year %',
                NEW.user_id, NEW.leave_type_id, v_year;
        END IF;

        -- Re-compute remaining AFTER acquiring the lock (reflects any concurrent commits)
        v_remaining := v_total_days - v_used_days;

        IF v_remaining < v_days THEN
            RAISE EXCEPTION
                'Insufficient leave balance. Requested: %, Remaining after lock: %',
                v_days, v_remaining;
        END IF;

        -- Safe to deduct — we hold the exclusive row lock
        UPDATE public.leave_balances
        SET    used_days  = used_days + v_days,
               updated_at = NOW()
        WHERE  id = v_balance_id;

    -- ──────────────────────────────────────────────────────────────────────────
    -- RESTORE PATH: transition FROM 'approved' to 'cancelled' or 'rejected'
    -- ──────────────────────────────────────────────────────────────────────────
    ELSIF OLD.status = 'approved' AND NEW.status IN ('cancelled', 'rejected') THEN

        -- Lock the row before restoring to prevent concurrent restore+approve races
        SELECT id INTO v_balance_id
        FROM public.leave_balances
        WHERE user_id        = NEW.user_id
          AND leave_type_id  = NEW.leave_type_id
          AND year           = v_year
        FOR UPDATE;

        IF FOUND THEN
            UPDATE public.leave_balances
            SET    used_days  = GREATEST(0, used_days - v_days), -- GREATEST(0,...) guards against negative used_days
                   updated_at = NOW()
            WHERE  id = v_balance_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger (idempotent)
DROP TRIGGER IF EXISTS trigger_leave_balance_deduction ON public.leave_requests;
CREATE TRIGGER trigger_leave_balance_deduction
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW
    WHEN (NEW.status IS DISTINCT FROM OLD.status)
    EXECUTE FUNCTION public.process_leave_balance_deduction();

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
