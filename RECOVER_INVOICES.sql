-- ==============================================================================
-- REVENUE RECOVERY: RE-GENERATE INVOICES FROM WON LEADS
-- ==============================================================================
-- Run this to recreate the missing invoices and restore your revenue dashboard.
-- ==============================================================================

DO $$ 
DECLARE 
  lead_record RECORD;
  target_user_id UUID;
  new_client_id UUID;
  invoice_count INTEGER := 0;
BEGIN
  -- 1. Find the admin user to assign these to
  SELECT id INTO target_user_id FROM profiles WHERE role = 'admin' LIMIT 1;
  
  IF target_user_id IS NULL THEN
    RAISE NOTICE 'No admin user found. Please create a profile first.';
    RETURN;
  END IF;

  -- 2. Loop through all Won leads that don't have a client record yet
  FOR lead_record IN 
    SELECT * FROM leads WHERE status = 'closed_won' 
    AND id NOT IN (SELECT lead_id FROM clients WHERE lead_id IS NOT NULL)
  LOOP
    -- Create a Client record first
    INSERT INTO clients (user_id, lead_id, name, email, contract_value)
    VALUES (target_user_id, lead_record.id, lead_record.first_name || ' ' || COALESCE(lead_record.last_name, ''), lead_record.email, lead_record.value)
    RETURNING id INTO new_client_id;

    -- Create the Invoice
    INSERT INTO invoices (user_id, client_id, invoice_number, amount, status, issued_at)
    VALUES (
      target_user_id, 
      new_client_id, 
      'INV-' || UPPER(LEFT(lead_record.first_name, 3)) || '-' || floor(random() * 9000 + 1000)::text,
      COALESCE(lead_record.value, 0),
      'paid',
      lead_record.created_at
    );
    
    invoice_count := invoice_count + 1;
  END LOOP;
  
  RAISE NOTICE 'Successfully recovered % invoices and created linked clients.', invoice_count;
END $$;
