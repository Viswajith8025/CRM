-- ==============================================================================
-- GST SEED DATA
-- Seeds default tax rules and sets up the gst_profiles infrastructure
-- Run this AFTER ENTERPRISE_BILLING_GST_ENGINE.sql
-- ==============================================================================

-- Seed GST Tax Rules (Standard Indian GST Slabs)
-- These will be organization-specific in production; we seed for the default org.
INSERT INTO public.tax_rules (name, type, rate_percent, cgst_percent, sgst_percent, igst_percent, is_active)
VALUES
  ('GST 0%',     'intra_state',  0,   0,    0,    0,    true),
  ('GST 5%',     'intra_state',  5,   2.5,  2.5,  0,    true),
  ('GST 12%',    'intra_state', 12,   6,    6,    0,    true),
  ('GST 18%',    'intra_state', 18,   9,    9,    0,    true),
  ('GST 28%',    'intra_state', 28,  14,   14,    0,    true),
  ('IGST 0%',    'inter_state',  0,   0,    0,    0,    true),
  ('IGST 5%',    'inter_state',  5,   0,    0,    5,    true),
  ('IGST 12%',   'inter_state', 12,   0,    0,   12,    true),
  ('IGST 18%',   'inter_state', 18,   0,    0,   18,    true),
  ('IGST 28%',   'inter_state', 28,   0,    0,   28,    true),
  ('Exempt',     'exempt',       0,   0,    0,    0,    true),
  ('Zero Rated', 'export',       0,   0,    0,    0,    true)
ON CONFLICT DO NOTHING;

-- Add missing columns to invoices table if not already there
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20) DEFAULT 'intra_state'; -- intra_state, inter_state

NOTIFY pgrst, 'reload schema';
