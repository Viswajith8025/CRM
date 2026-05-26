-- ==============================================================================
-- ENTERPRISE BILLING CONCURRENCY CONTROL
-- Uses Row-Level Locking (SELECT FOR UPDATE) to safely process payments
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.process_invoice_payment(
    p_invoice_id UUID,
    p_org_id UUID,
    p_user_id UUID,
    p_amount DECIMAL,
    p_method TEXT,
    p_transaction_id TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_invoice RECORD;
    v_total_paid DECIMAL;
    v_new_status TEXT;
    v_payment_id UUID;
BEGIN
    -- 1. Lock the invoice row to prevent concurrent payment processing race conditions
    SELECT * INTO v_invoice 
    FROM public.invoices 
    WHERE id = p_invoice_id AND organization_id = p_org_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice not found or access denied.');
    END IF;

    -- 2. Verify payment makes sense
    IF v_invoice.status = 'paid' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invoice is already fully paid.');
    END IF;

    -- Calculate how much has been paid so far including this new payment
    SELECT COALESCE(SUM(amount_applied), 0) INTO v_total_paid
    FROM public.payment_receipts
    WHERE invoice_id = p_invoice_id;

    v_total_paid := v_total_paid + p_amount;

    -- 3. Determine new status
    IF v_total_paid >= v_invoice.grand_total THEN
        v_new_status := 'paid';
    ELSIF v_total_paid > 0 THEN
        v_new_status := 'partially_paid';
    ELSE
        v_new_status := v_invoice.status;
    END IF;

    -- 4. Insert the payment record
    INSERT INTO public.payments (
        organization_id, client_id, payment_number, amount, payment_mode, 
        reference_number, notes, status, date, created_by
    ) VALUES (
        p_org_id, v_invoice.client_id, 'PAY-' || substr(md5(random()::text), 1, 8), p_amount, p_method, 
        p_transaction_id, p_notes, 'verified', CURRENT_DATE, p_user_id
    ) RETURNING id INTO v_payment_id;

    -- 5. Create the receipt mapping (This automatically updates invoice via triggers, but we still update status here)
    INSERT INTO public.payment_receipts (
        payment_id, invoice_id, amount_applied
    ) VALUES (
        v_payment_id, p_invoice_id, p_amount
    );

    -- 6. Force the status update (since the trigger only updates amounts)
    UPDATE public.invoices 
    SET status = v_new_status, updated_at = NOW() 
    WHERE id = p_invoice_id;

    RETURN jsonb_build_object(
        'success', true, 
        'payment_id', v_payment_id,
        'new_status', v_new_status,
        'total_paid', v_total_paid
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
