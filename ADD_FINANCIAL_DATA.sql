-- ============================================================
-- Migration: Add financial_data column to form_submissions
-- Run this in your Supabase SQL editor
-- ============================================================

ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS financial_data JSONB DEFAULT NULL;

-- Optional index for fast financial queries
CREATE INDEX IF NOT EXISTS idx_form_submissions_financial_data
  ON form_submissions USING gin (financial_data);

-- ============================================================
-- The financial_data JSONB stores:
-- {
--   "project_cost": 50000,
--   "paid_amount":  20000,
--   "balance":      30000,
--   "payment_status": "partial",  -- "unpaid" | "partial" | "paid"
--   "notes": "50% upfront, rest on delivery"
-- }
-- ============================================================
