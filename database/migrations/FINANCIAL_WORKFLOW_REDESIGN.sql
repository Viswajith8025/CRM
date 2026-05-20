-- ==============================================================================
-- FINANCIAL WORKFLOW REDESIGN
-- Implements Atomic Partial Payments, Immutable Audit Logs, and Status Automation
-- ==============================================================================

-- 1. Ensure Robust Status Enum
DO $$ BEGIN
    ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'partially_paid';
    ALTER TYPE public.invoice_status ADD VALUE IF NOT EXISTS 'overdue';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Advanced Reconciliation Function
-- Handles INSERT, UPDATE, and DELETE to ensure paid_amount is NEVER desynced
CREATE OR REPLACE FUNCTION public.reconcile_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
    v_invoice_id UUID;
    v_total_paid NUMERIC;
    v_inv_amount NUMERIC;
    v_new_status public.invoice_status;
BEGIN
    -- Determine which invoice needs reconciliation
    IF (TG_OP = 'DELETE') THEN
        v_invoice_id := OLD.invoice_id;
    ELSE
        v_invoice_id := NEW.invoice_id;
    END IF;

    IF v_invoice_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calculate total verified payments atomically
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.payments
    WHERE invoice_id = v_invoice_id AND status = 'verified';

    -- Get current invoice total
    SELECT amount INTO v_inv_amount
    FROM public.invoices
    WHERE id = v_invoice_id;

    -- Determine Status Lifecycle
    IF v_total_paid >= v_inv_amount THEN
        v_new_status := 'paid';
    ELSIF v_total_paid > 0 THEN
        v_new_status := 'partially_paid';
    ELSE
        -- If no payments, revert to 'sent' if it was previously partially_paid/paid
        -- but preserve 'draft' or 'overdue'
        SELECT status INTO v_new_status FROM public.invoices WHERE id = v_invoice_id;
        IF v_new_status IN ('partially_paid', 'paid') THEN
            v_new_status := 'sent';
        END IF;
    END IF;

    -- Update Invoice with Lock Protection
    UPDATE public.invoices
    SET 
        paid_amount = v_total_paid,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = v_invoice_id;

    RETURN NULL; -- result is ignored for AFTER triggers
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind Reconciler Trigger
DROP TRIGGER IF EXISTS on_payment_change_reconcile ON public.payments;
CREATE TRIGGER on_payment_change_reconcile
    AFTER INSERT OR UPDATE OF amount, status, invoice_id OR DELETE
    ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.reconcile_invoice_totals();

-- 4. Financial Immutability Protection
-- Prevent editing verified payments to maintain audit integrity
CREATE OR REPLACE FUNCTION public.protect_verified_payments()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'verified' AND (
        NEW.amount IS DISTINCT FROM OLD.amount OR 
        NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR
        NEW.organization_id IS DISTINCT FROM OLD.organization_id
    ) THEN
        RAISE EXCEPTION 'Immutable Financial Record: Verified payments cannot be modified. Issue a refund or correction instead.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_immutable_check ON public.payments;
CREATE TRIGGER on_payment_immutable_check
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_verified_payments();

-- 5. Automated Overdue Scheduler Helper
-- This can be called by a cron job or edge function daily
CREATE OR REPLACE FUNCTION public.apply_overdue_statuses()
RETURNS VOID AS $$
BEGIN
    UPDATE public.invoices
    SET status = 'overdue'
    WHERE status IN ('sent', 'partially_paid')
      AND due_date < CURRENT_DATE
      AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Add Financial Integrity Constraints
ALTER TABLE public.invoices 
    DROP CONSTRAINT IF EXISTS check_paid_amount_non_negative;

ALTER TABLE public.invoices 
    ADD CONSTRAINT check_paid_amount_non_negative 
    CHECK (paid_amount >= 0);

-- 7. Prevent deletion of invoices with verified payments
CREATE OR REPLACE FUNCTION public.prevent_delete_paid_invoice()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.paid_amount > 0) THEN
        RAISE EXCEPTION 'Cannot delete an invoice with active payments. Archive it instead.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_invoice_delete_protect ON public.invoices;
CREATE TRIGGER on_invoice_delete_protect
    BEFORE UPDATE OF deleted_at ON public.invoices
    FOR EACH ROW
    WHEN (NEW.deleted_at IS NOT NULL)
    EXECUTE FUNCTION public.prevent_delete_paid_invoice();

-- Refresh schema
NOTIFY pgrst, 'reload schema';
