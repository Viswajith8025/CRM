-- ==============================================================================
-- CRITICAL FIX: BILLING FINANCIAL INTEGRITY & AMOUNT_DUE SYNCHRONIZATION
-- ==============================================================================
-- ISSUE: The system previously only recalculated invoice `amount_due` when a 
-- payment receipt was created (via `trigger_update_invoice_balance`). If an 
-- admin edited the `grand_total` of an invoice AFTER creation, the `amount_due` 
-- was permanently out of sync. Furthermore, editing a fully paid invoice was
-- not blocked at the database level.
-- ==============================================================================

-- 1. Function to lock paid invoices and recalculate `amount_due` on update
CREATE OR REPLACE FUNCTION public.check_invoice_modifications()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Security Lock: Prevent altering grand_total if already fully paid
    IF OLD.status = 'paid' AND NEW.grand_total != OLD.grand_total THEN
        RAISE EXCEPTION 'Financial Integrity Policy: Cannot modify grand total of a fully paid invoice.';
    END IF;

    -- 2. Synchronization: Recalculate amount_due if grand_total is modified
    IF NEW.grand_total != OLD.grand_total THEN
        -- Recalculate based on existing payments
        NEW.amount_due := NEW.grand_total - COALESCE(OLD.amount_paid, 0);
        
        -- 3. State Reconciliation: Automatically revert status if they increased the total
        IF OLD.status = 'paid' AND NEW.amount_due > 0 THEN
             NEW.status := 'partially_paid';
        END IF;

        -- 4. Overpayment check (edge case if total is reduced below paid amount)
        IF NEW.amount_due < 0 THEN
             -- You could raise an exception here, but marking it paid and leaving amount_due negative 
             -- allows for a "credit" representation. For strictness:
             -- RAISE EXCEPTION 'New grand total cannot be less than already paid amount.';
             NEW.status := 'paid';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Apply Trigger to Invoices Table
DROP TRIGGER IF EXISTS trigger_invoice_modifications ON public.invoices;
CREATE TRIGGER trigger_invoice_modifications
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION public.check_invoice_modifications();

NOTIFY pgrst, 'reload schema';
