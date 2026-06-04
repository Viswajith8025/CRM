-- ==============================================================================
-- FIX: LEAVE BALANCE ENGINE ENUM CASTING
--
-- Root cause:
--   The trigger `handle_leave_balance_update` compares `NEW.status` (ENUM)
--   with `v_old_status` (TEXT) and text literals like 'pending'.
--   This causes "operator does not exist: text = leave_request_status".
--
-- Fix:
--   Cast NEW.status and OLD.status explicitly to TEXT for comparison logic.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_leave_balance_update()
RETURNS TRIGGER AS $$
DECLARE
    v_days INTEGER;
    v_year INTEGER;
    v_policy RECORD;
    v_balance RECORD;
    v_old_status TEXT;
    v_new_status TEXT;
    v_allocated INTEGER;
BEGIN
    -- Calculate requested days (inclusive)
    v_days := (NEW.end_date - NEW.start_date) + 1;
    v_year := EXTRACT(YEAR FROM NEW.start_date);

    -- Cast the enum status to TEXT safely
    v_new_status := NEW.status::TEXT;

    -- Normalize old status for INSERT vs UPDATE
    IF TG_OP = 'INSERT' THEN
        v_old_status := 'none';
    ELSE
        v_old_status := OLD.status::TEXT;
    END IF;

    -- Exit early if status didn't change
    IF v_old_status = v_new_status THEN
        RETURN NEW;
    END IF;

    -- 2. Get or initialize the balance record
    SELECT * INTO v_balance FROM public.leave_balances 
    WHERE user_id = NEW.user_id AND leave_type_id = NEW.leave_type_id AND year = v_year;

    IF NOT FOUND THEN
        -- Find the policy limit to initialize `allocated`
        SELECT yearly_limit INTO v_policy FROM public.leave_policies 
        WHERE leave_type_id = NEW.leave_type_id AND organization_id = NEW.organization_id 
        LIMIT 1;

        v_allocated := COALESCE(v_policy.yearly_limit, 0);
        
        INSERT INTO public.leave_balances (organization_id, user_id, leave_type_id, year, allocated, used, pending)
        VALUES (NEW.organization_id, NEW.user_id, NEW.leave_type_id, v_year, v_allocated, 0, 0)
        RETURNING * INTO v_balance;
    END IF;

    -- 3. Balance Validation (Only block when submitting a NEW request or moving to approved)
    IF v_new_status IN ('pending', 'approved') AND v_old_status NOT IN ('pending', 'approved') THEN
        IF (v_balance.used + v_balance.pending + v_days) > v_balance.allocated THEN
            RAISE EXCEPTION 'Insufficient leave balance. You have % days remaining.', (v_balance.allocated - v_balance.used - v_balance.pending);
        END IF;
    END IF;

    -- 4. Revert OLD state
    IF v_old_status = 'pending' THEN
        UPDATE public.leave_balances SET pending = pending - v_days, updated_at = now() WHERE id = v_balance.id;
    ELSIF v_old_status = 'approved' THEN
        UPDATE public.leave_balances SET used = used - v_days, updated_at = now() WHERE id = v_balance.id;
    END IF;

    -- 5. Apply NEW state
    IF v_new_status = 'pending' THEN
        UPDATE public.leave_balances SET pending = pending + v_days, updated_at = now() WHERE id = v_balance.id;
    ELSIF v_new_status = 'approved' THEN
        UPDATE public.leave_balances SET used = used + v_days, updated_at = now() WHERE id = v_balance.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
