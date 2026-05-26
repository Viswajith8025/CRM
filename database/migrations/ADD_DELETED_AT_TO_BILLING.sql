-- Adds soft delete support to the new Enterprise Billing tables
-- This fixes the '400 Bad Request' errors caused by the frontend attempting to filter by deleted_at

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.estimates ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.proforma_invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.client_statements ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
