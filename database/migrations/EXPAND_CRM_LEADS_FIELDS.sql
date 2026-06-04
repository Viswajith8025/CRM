-- ==============================================================================
-- EXPAND CRM LEADS SCHEMA TO MATCH CLIENT ONBOARDING
-- ==============================================================================
-- Adds all the detailed business fields to the leads and clients tables so 
-- manual CRM entries can mirror the data collected in the automated onboarding.
-- ==============================================================================

-- 1. ADD NEW COLUMNS TO LEADS
ALTER TABLE public.leads 
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
  ADD COLUMN IF NOT EXISTS website VARCHAR(255),
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS business_type VARCHAR(50), -- B2B, B2C, Ecommerce, SaaS, Hybrid
  ADD COLUMN IF NOT EXISTS services_needed TEXT, -- Comma separated
  ADD COLUMN IF NOT EXISTS target_locations TEXT,
  ADD COLUMN IF NOT EXISTS has_instagram BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ig_username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ig_password VARCHAR(255),
  ADD COLUMN IF NOT EXISTS li_username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS li_password VARCHAR(255);

-- 2. ADD CORRESPONDING COLUMNS TO CLIENTS (For syncing)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(50),
  ADD COLUMN IF NOT EXISTS business_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS services_needed TEXT,
  ADD COLUMN IF NOT EXISTS target_locations TEXT,
  ADD COLUMN IF NOT EXISTS has_instagram BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ig_username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS ig_password VARCHAR(255),
  ADD COLUMN IF NOT EXISTS li_username VARCHAR(100),
  ADD COLUMN IF NOT EXISTS li_password VARCHAR(255);

-- (Address and website already exist on clients table)

NOTIFY pgrst, 'reload schema';
