-- ==============================================================================
-- CLEANUP UNUSED BILLING TABLES & VIEWS
-- Removes redundant and deprecated tables to keep the database schema clean
-- ==============================================================================

-- 1. Drop the active_invoices view
-- This view was created but is not actively used by the frontend CRM codebase
DROP VIEW IF EXISTS public.active_invoices;

-- 2. Drop Proforma Invoices & Items
-- The system manages draft invoices using the main `invoices` table with status='draft'
-- These tables were created during the GST engine upgrade but never wired to the UI.
DROP TABLE IF EXISTS public.proforma_items CASCADE;
DROP TABLE IF EXISTS public.proforma_invoices CASCADE;

-- 3. Drop Legacy Backup Tables
-- These tables were created as a safety backup during the massive Enterprise Billing upgrade.
-- Since RESTORE_LEGACY_INVOICES has already been run and the data migrated to the new schema, 
-- these backups are no longer needed.
DROP TABLE IF EXISTS public.legacy_invoices CASCADE;
DROP TABLE IF EXISTS public.legacy_payments CASCADE;

-- Note: The following tables are actively REQUIRED for enterprise functionality and remain:
-- * invoices (Main table)
-- * invoice_items (Line items)
-- * invoice_taxes (GST tax breakdown)
-- * invoice_revisions (Invoice history tracking)
-- * invoice_audit_logs (Immutable audit trails for compliance)

NOTIFY pgrst, 'reload schema';
