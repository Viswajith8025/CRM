-- ==============================================================================
-- COMPLETE CLEANUP OF UNUSED SUPABASE TABLES
-- ==============================================================================
-- This script safely drops 31 tables that were created during development but 
-- are NEVER referenced in the actual application code or active database triggers.
-- ==============================================================================

BEGIN;

-- 1. Legacy & Duplicate Audit Logs
DROP TABLE IF EXISTS enterprise_audit_logs CASCADE;
DROP TABLE IF EXISTS legacy_client_statements CASCADE;

-- 2. Unused HR / ESSL Modules
DROP TABLE IF EXISTS hr_attendance CASCADE;
DROP TABLE IF EXISTS hr_employees CASCADE;
DROP TABLE IF EXISTS hr_payroll CASCADE;
DROP TABLE IF EXISTS essl_device_settings CASCADE;

-- 3. Unused Marketing / Leads Features
DROP TABLE IF EXISTS marketing_campaigns CASCADE;
DROP TABLE IF EXISTS marketing_keywords CASCADE;
DROP TABLE IF EXISTS marketing_posts CASCADE;
DROP TABLE IF EXISTS lead_activities CASCADE;

-- 4. Unused Estimates Module
DROP TABLE IF EXISTS estimate_items CASCADE;
DROP TABLE IF EXISTS estimates CASCADE;

-- 5. Unused Analytics & Misc Settings
DROP TABLE IF EXISTS department_performance CASCADE;
DROP TABLE IF EXISTS graph_registry CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS organization_features CASCADE;
DROP TABLE IF EXISTS submodule_registry CASCADE;

-- 6. Unused Forms & Onboarding tables
DROP TABLE IF EXISTS form_conditions CASCADE;
DROP TABLE IF EXISTS onboarding_submissions CASCADE;

-- 7. Unused Auth, Security & Rate Limit tables
DROP TABLE IF EXISTS auth_events CASCADE;
DROP TABLE IF EXISTS rate_limits CASCADE;
DROP TABLE IF EXISTS role_change_audit CASCADE;
DROP TABLE IF EXISTS settings_audit_logs CASCADE;

-- 8. Unused RBAC tables (App uses standard roles)
DROP TABLE IF EXISTS rbac_permissions CASCADE;
DROP TABLE IF EXISTS rbac_role_permissions CASCADE;
DROP TABLE IF EXISTS rbac_user_permissions CASCADE;
DROP TABLE IF EXISTS profile_roles CASCADE;

-- 9. Unused Support Tickets
DROP TABLE IF EXISTS support_ticket_messages CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;

-- 10. Unused Workflows & Payments
DROP TABLE IF EXISTS workflow_logs CASCADE;
DROP TABLE IF EXISTS payment_methods CASCADE;

COMMIT;
