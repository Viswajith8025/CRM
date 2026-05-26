-- ==============================================================================
-- RESTORE LEGACY BILLING DATA
-- Migrates data from legacy_invoices and legacy_payments into the new schema
-- ==============================================================================

DO $$
DECLARE
    rec RECORD;
    v_payment_id UUID;
    v_client_id UUID;
BEGIN
    -- 1. Restore Invoices
    -- If the new invoices table is empty, or we just want to safely insert missing ones
    INSERT INTO public.invoices (
        id,
        organization_id,
        client_id,
        project_id,
        invoice_number,
        date,
        due_date,
        status,
        subtotal,
        total_tax,
        grand_total,
        amount_due,
        created_by,
        created_at,
        updated_at
    )
    SELECT 
        id,
        organization_id,
        client_id,
        project_id,
        invoice_number,
        COALESCE(issued_at, created_at::date),
        due_date,
        status::text,
        COALESCE(amount - tax_amount, 0), -- Subtotal
        COALESCE(tax_amount, 0),          -- Total Tax
        COALESCE(amount, 0),              -- Grand Total
        COALESCE(amount, 0),              -- Amount Due (will be updated by payments)
        user_id,
        created_at,
        updated_at
    FROM public.legacy_invoices
    ON CONFLICT (id) DO NOTHING; -- Skip if already migrated

    -- 2. Restore Payments & Link them via Payment Receipts
    FOR rec IN SELECT * FROM public.legacy_payments LOOP
        
        -- Get the client_id from the linked invoice
        SELECT client_id INTO v_client_id 
        FROM public.invoices WHERE id = rec.invoice_id;

        -- Create the payment record
        INSERT INTO public.payments (
            id,
            organization_id,
            client_id,
            payment_number,
            date,
            amount,
            payment_mode,
            reference_number,
            status,
            created_by,
            created_at
        ) VALUES (
            rec.id,
            rec.organization_id,
            v_client_id,
            'PAY-' || substr(md5(random()::text), 1, 6), -- Generate a fallback payment number
            COALESCE(rec.paid_at::date, rec.paid_at::date),
            rec.amount,
            rec.payment_method,
            rec.transaction_id,
            'verified',
            rec.user_id,
            rec.paid_at
        )
        ON CONFLICT (id) DO NOTHING
        RETURNING id INTO v_payment_id;

        -- If payment was successfully inserted (or already exists, we can still link it)
        IF v_payment_id IS NULL THEN
            v_payment_id := rec.id;
        END IF;

        -- Create the receipt mapping
        INSERT INTO public.payment_receipts (
            payment_id,
            invoice_id,
            amount_applied,
            created_at
        ) VALUES (
            v_payment_id,
            rec.invoice_id,
            rec.amount,
            rec.paid_at
        )
        ON CONFLICT DO NOTHING;

    END LOOP;

    -- The triggers on payment_receipts will automatically update the `invoices.amount_paid` 
    -- and `invoices.amount_due` during the loop above!
    
END $$;
