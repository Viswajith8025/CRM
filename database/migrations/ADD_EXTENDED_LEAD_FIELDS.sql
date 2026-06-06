-- Migration to add extended onboarding and contact fields to the leads table
-- These fields were added to the frontend but missing in the database schema

BEGIN;

DO $$ 
BEGIN
    -- Contact/General details
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS website TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS business_type TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS services_needed TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS target_locations TEXT;
    
    -- Social Media details
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_instagram BOOLEAN DEFAULT false;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS ig_username TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS ig_password TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS li_username TEXT;
    ALTER TABLE leads ADD COLUMN IF NOT EXISTS li_password TEXT;
EXCEPTION WHEN others THEN
    -- Ignore errors if columns already exist or if table doesn't exist
    NULL;
END $$;

COMMIT;
