-- This script fixes "missed revenue" by creating payment records for all invoices currently marked as 'paid'
-- that do not already have a corresponding record in the payments table.

INSERT INTO payments (user_id, organization_id, invoice_id, amount, payment_method, paid_at)
SELECT 
    i.user_id, 
    i.organization_id, 
    i.id as invoice_id, 
    i.amount, 
    'historical' as payment_method, 
    i.updated_at as paid_at
FROM invoices i
LEFT JOIN payments p ON i.id = p.invoice_id
WHERE i.status = 'paid' 
AND p.id IS NULL;

-- Verification query:
-- SELECT * FROM payments WHERE payment_method = 'historical';
