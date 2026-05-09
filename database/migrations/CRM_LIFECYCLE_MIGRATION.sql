-- ==============================================================================
-- REAL-WORLD CRM BUSINESS WORKFLOW UPGRADE
-- Lead -> Proposal -> Payment -> Active Client
-- ==============================================================================

-- 1. UPDATE LEAD STATUS ENUM (Postgres only allows adding to ENUMs)
DO $$ 
BEGIN 
  ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'proposal_sent';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ 
BEGIN 
  ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ 
BEGIN 
  ALTER TYPE lead_status ADD VALUE IF NOT EXISTS 'active_client';
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- 2. LINK PAYMENTS TO PROPOSALS
ALTER TABLE payments ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE;

-- 3. PROPOSAL -> INVOICE AUTOMATION (Trigger)
-- When a proposal is approved, automatically generate an invoice
CREATE OR REPLACE FUNCTION handle_proposal_approval()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Insert a drafted invoice
    INSERT INTO invoices (
      user_id, organization_id, client_id, proposal_id, 
      invoice_number, amount, status, due_date
    ) VALUES (
      NEW.user_id, NEW.organization_id, NEW.client_id, NEW.id,
      'INV-' || to_char(now(), 'YYYYMMDD') || '-' || substring(NEW.id::text from 1 for 4),
      NEW.amount, 'draft', CURRENT_DATE + interval '7 days'
    );
    
    -- Update lead status to awaiting payment if linked
    IF NEW.lead_id IS NOT NULL THEN
      UPDATE leads SET status = 'awaiting_payment' WHERE id = NEW.lead_id;
    END IF;

    -- Audit log
    INSERT INTO activities (
      user_id, organization_id, action, target_type, target_id, target_name
    ) VALUES (
      NEW.user_id, NEW.organization_id, 'approved', 'proposal', NEW.id, NEW.title
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_proposal_approved ON proposals;
CREATE TRIGGER on_proposal_approved
  AFTER UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION handle_proposal_approval();

-- 4. PAYMENT -> ACTIVE CLIENT AUTOMATION (Trigger)
-- When an invoice/proposal payment is fully paid, convert lead to active client
CREATE OR REPLACE FUNCTION handle_payment_received()
RETURNS trigger AS $$
DECLARE
  v_lead_id UUID;
BEGIN
  -- If payment is tied to an invoice which is tied to a proposal
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT p.lead_id INTO v_lead_id
    FROM invoices i
    JOIN proposals p ON i.proposal_id = p.id
    WHERE i.id = NEW.invoice_id;
  -- Or if payment is tied directly to a proposal
  ELSIF NEW.proposal_id IS NOT NULL THEN
    SELECT lead_id INTO v_lead_id FROM proposals WHERE id = NEW.proposal_id;
  END IF;

  IF v_lead_id IS NOT NULL THEN
    -- Update lead to active client
    UPDATE leads SET status = 'active_client' WHERE id = v_lead_id;

    -- Automatically convert lead to client if not already done
    -- (Assuming your app logic does this, we can ensure the record exists)
    INSERT INTO clients (user_id, organization_id, name, email, phone, status)
    SELECT user_id, organization_id, COALESCE(first_name || ' ' || last_name, first_name), email, phone, 'active'
    FROM leads
    WHERE id = v_lead_id
    ON CONFLICT DO NOTHING;

    -- Audit log
    INSERT INTO activities (
      user_id, organization_id, action, target_type, target_id, target_name
    ) VALUES (
      NEW.user_id, NEW.organization_id, 'activated client via payment', 'lead', v_lead_id, 'Payment Received'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_payment_received ON payments;
CREATE TRIGGER on_payment_received
  AFTER INSERT ON payments
  FOR EACH ROW EXECUTE FUNCTION handle_payment_received();
