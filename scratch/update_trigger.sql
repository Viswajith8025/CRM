CREATE OR REPLACE FUNCTION public.rebuild_client_statement_ledger()
RETURNS TRIGGER AS $$
DECLARE
  v_client_id UUID;
  v_org_id UUID;
  r RECORD;
  v_balance NUMERIC(15, 2) := 0.00;
  v_billed NUMERIC(15, 2) := 0.00;
  v_received NUMERIC(15, 2) := 0.00;
  v_overdue NUMERIC(15, 2) := 0.00;
  v_advance NUMERIC(15, 2) := 0.00;
BEGIN
  -- Determine Client Context
  IF TG_OP = 'DELETE' THEN
    v_client_id := OLD.client_id;
    v_org_id := OLD.organization_id;
  ELSE
    v_client_id := NEW.client_id;
    v_org_id := NEW.organization_id;
  END IF;

  -- 1. Wipe client statements timeline for full recalculation
  DELETE FROM public.client_statements WHERE client_id = v_client_id;

  -- 2. Insert Invoices as Debits
  INSERT INTO public.client_statements (organization_id, client_id, entry_type, entry_date, reference_id, reference_number, debit, credit, running_balance, description)
  SELECT 
    organization_id,
    client_id,
    'invoice'::text,
    created_at,
    id,
    invoice_number,
    amount,
    0.00,
    0.00,
    CONCAT('Invoice generated: ', invoice_number)
  FROM public.invoices
  WHERE client_id = v_client_id AND (deleted_at IS NULL);

  -- 3. Insert Payments as Credits
  INSERT INTO public.client_statements (organization_id, client_id, entry_type, entry_date, reference_id, reference_number, debit, credit, running_balance, description)
  SELECT 
    organization_id,
    client_id,
    'payment'::text,
    payment_date,
    id,
    CONCAT('PAY-', UPPER(SUBSTRING(id::text, 1, 6))),
    0.00,
    amount,
    0.00,
    CONCAT('Payment received via ', UPPER(payment_method), ' (Txn ID: ', COALESCE(transaction_id, 'N/A'), ')')
  FROM public.client_payments
  WHERE client_id = v_client_id;

  -- 4. Calculate chronological running balance via cursor
  FOR r IN 
    SELECT id, debit, credit 
    FROM public.client_statements 
    WHERE client_id = v_client_id 
    ORDER BY entry_date ASC, created_at ASC
  LOOP
    v_balance := v_balance + r.debit - r.credit;
    UPDATE public.client_statements SET running_balance = v_balance WHERE id = r.id;
  END LOOP;

  -- 5. Calculate summaries
  SELECT COALESCE(SUM(amount), 0.00) INTO v_billed FROM public.invoices WHERE client_id = v_client_id AND (deleted_at IS NULL);
  SELECT COALESCE(SUM(amount), 0.00) INTO v_received FROM public.client_payments WHERE client_id = v_client_id;
  
  -- Overdue Calculation (unpaid invoices past due date)
  SELECT COALESCE(SUM(amount), 0.00) INTO v_overdue 
  FROM public.invoices 
  WHERE client_id = v_client_id 
    AND (deleted_at IS NULL) 
    AND status = 'overdue';

  -- Calculate Advance Balance (payments exceeds billed invoices)
  IF v_received > v_billed THEN
    v_advance := v_received - v_billed;
  ELSE
    v_advance := 0.00;
  END IF;

  -- 6. Upsert real-time Summary
  INSERT INTO public.client_balance_summary (organization_id, client_id, total_billed, total_received, overdue_amount, advance_balance, outstanding_balance, last_updated_at)
  VALUES (v_org_id, v_client_id, v_billed, v_received, v_overdue, v_advance, (v_billed - v_received), NOW())
  ON CONFLICT (client_id) DO UPDATE SET 
    total_billed = EXCLUDED.total_billed,
    total_received = EXCLUDED.total_received,
    overdue_amount = EXCLUDED.overdue_amount,
    advance_balance = EXCLUDED.advance_balance,
    outstanding_balance = EXCLUDED.outstanding_balance,
    last_updated_at = NOW();

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
