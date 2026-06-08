-- ENTERPRISE FINANCIAL INTEGRITY: Immutable Invoices
-- Addresses Audit Finding: "Financial mutability. The ability to potentially UPDATE an invoice rather than issuing a credit note is a standard ERP anti-pattern."

BEGIN;

CREATE OR REPLACE FUNCTION enforce_immutable_paid_invoices()
RETURNS TRIGGER AS $$
BEGIN
    -- If the invoice is already paid in the database, prevent critical alterations
    IF OLD.status = 'paid' THEN
        
        -- Prevent changing the total amount after payment is recorded
        IF NEW.grand_total IS DISTINCT FROM OLD.grand_total THEN
            RAISE EXCEPTION 'FINANCIAL AUDIT BLOCK: Cannot alter the grand total of a fully paid invoice. You must issue a credit note or a refund instead.';
        END IF;

        -- Prevent changing the client after payment is recorded
        IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
            RAISE EXCEPTION 'FINANCIAL AUDIT BLOCK: Cannot reassign a paid invoice to a different client.';
        END IF;

        -- Prevent un-paying an invoice directly (must go through refund/void workflow)
        IF NEW.status = 'draft' OR NEW.status = 'sent' THEN
            RAISE EXCEPTION 'FINANCIAL AUDIT BLOCK: Cannot revert a paid invoice to draft or sent. Use the refund/void process.';
        END IF;
        
    END IF;

    -- Standard updated_at bump
    NEW.updated_at := now();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_enforce_immutable_paid_invoices ON invoices;
CREATE TRIGGER trg_enforce_immutable_paid_invoices
BEFORE UPDATE ON public.invoices
FOR EACH ROW EXECUTE FUNCTION enforce_immutable_paid_invoices();

COMMIT;
