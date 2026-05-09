-- ==============================================================================
-- E-SIGNATURE & DOCUMENT APPROVAL SYSTEM MIGRATION
-- Proposals, Contracts, and Invoices
-- ==============================================================================

-- 1. ADD SIGNATURE FIELDS TO PROPOSALS
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS signer_ip TEXT;

-- 2. ADD SIGNATURE FIELDS TO INVOICES
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signature_data TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signer_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS signer_ip TEXT;

-- 3. CREATE CONTRACTS TABLE
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL DEFAULT public.get_my_org_id(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'pending', 'signed', 'void'
  signature_data TEXT,
  signed_at TIMESTAMPTZ,
  signer_name TEXT,
  signer_ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ENABLE RLS FOR CONTRACTS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contracts_select" ON contracts;
CREATE POLICY "contracts_select" ON contracts FOR SELECT TO authenticated 
  USING (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "contracts_insert" ON contracts;
CREATE POLICY "contracts_insert" ON contracts FOR INSERT TO authenticated 
  WITH CHECK (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "contracts_update" ON contracts;
CREATE POLICY "contracts_update" ON contracts FOR UPDATE TO authenticated 
  USING (organization_id = public.get_my_org_id());

-- 5. NOTIFICATION TRIGGER FOR SIGNATURES
CREATE OR REPLACE FUNCTION public.notify_document_signed()
RETURNS TRIGGER AS $$
DECLARE
  org_admin_id UUID;
BEGIN
  -- Get organization admin (simplified: first admin found)
  SELECT id INTO org_admin_id FROM profiles 
  WHERE organization_id = NEW.organization_id AND role = 'admin' 
  LIMIT 1;

  IF NEW.status = 'signed' OR (TG_TABLE_NAME = 'proposals' AND NEW.status = 'approved' AND NEW.signature_data IS NOT NULL) THEN
    INSERT INTO notifications (
      user_id,
      organization_id,
      type,
      title,
      message,
      link,
      created_at
    ) VALUES (
      org_admin_id,
      NEW.organization_id,
      'system',
      'Document Signed',
      'A ' || TG_TABLE_NAME || ' has been signed and approved.',
      '/' || TG_TABLE_NAME || '/' || NEW.id,
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_proposal_signed ON proposals;
CREATE TRIGGER on_proposal_signed
  AFTER UPDATE ON proposals
  FOR EACH ROW EXECUTE FUNCTION public.notify_document_signed();

DROP TRIGGER IF EXISTS on_contract_signed ON contracts;
CREATE TRIGGER on_contract_signed
  AFTER UPDATE ON contracts
  FOR EACH ROW EXECUTE FUNCTION public.notify_document_signed();
