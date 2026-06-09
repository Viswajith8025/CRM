-- ==============================================================================
-- ENTERPRISE BILLING TEMPLATE UPGRADE V2
-- Adds billing settings, signatures, and bank details support
-- ==============================================================================

-- 1. Create Billing Settings Table (Bank Details, Signatures, Company Info)
CREATE TABLE IF NOT EXISTS public.billing_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.profiles(id), -- Or wherever orgs are stored
  
  -- Company Info
  company_name VARCHAR(255),
  company_logo TEXT,
  company_address TEXT,
  company_city VARCHAR(100),
  company_state VARCHAR(100),
  company_pincode VARCHAR(20),
  company_country VARCHAR(100) DEFAULT 'India',
  company_gstin VARCHAR(50),
  company_phone VARCHAR(50),
  company_email VARCHAR(255),
  company_website VARCHAR(255),
  
  -- Bank Details
  bank_account_name VARCHAR(255),
  bank_name VARCHAR(255),
  bank_branch VARCHAR(255),
  bank_account_number VARCHAR(100),
  bank_ifsc VARCHAR(50),
  bank_swift VARCHAR(50),
  company_pan VARCHAR(50),
  company_tan VARCHAR(50),
  
  -- Signatures & Terms
  default_terms TEXT,
  authorized_signature TEXT, -- URL to signature image
  company_stamp TEXT, -- URL to stamp image
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.billing_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "billing_settings_select" ON public.billing_settings
  FOR SELECT TO authenticated
  USING (organization_id = public.get_my_org_id());

CREATE POLICY "billing_settings_all" ON public.billing_settings
  FOR ALL TO authenticated
  USING (
    organization_id = public.get_my_org_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    organization_id = public.get_my_org_id()
  );

-- 2. Add document_type to Invoices
ALTER TABLE public.invoices 
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(50) DEFAULT 'Tax Invoice';

-- 3. Notify schema reload
NOTIFY pgrst, 'reload schema';
