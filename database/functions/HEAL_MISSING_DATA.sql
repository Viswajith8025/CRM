-- This script ensures all existing data belongs to the default organization
-- Use this if your invoices or clients "disappeared" after the security update.

-- 1. Fix Profiles (Ensure you have an organization ID)
UPDATE profiles 
SET organization_id = '00000000-0000-0000-0000-000000000000' 
WHERE organization_id IS NULL;

-- 2. Fix Invoices
UPDATE invoices 
SET organization_id = '00000000-0000-0000-0000-000000000000' 
WHERE organization_id IS NULL;

-- 3. Fix Payments
UPDATE payments 
SET organization_id = '00000000-0000-0000-0000-000000000000' 
WHERE organization_id IS NULL;

-- 4. Fix Clients
UPDATE clients 
SET organization_id = '00000000-0000-0000-0000-000000000000' 
WHERE organization_id IS NULL;

-- 5. Fix Projects
UPDATE projects 
SET organization_id = '00000000-0000-0000-0000-000000000000' 
WHERE organization_id IS NULL;

-- 6. Fix Tasks
UPDATE tasks 
SET organization_id = '00000000-0000-0000-0000-000000000000' 
WHERE organization_id IS NULL;

-- Verify
SELECT 'Profiles fixed' as msg, count(*) FROM profiles WHERE organization_id = '00000000-0000-0000-0000-000000000000';
SELECT 'Invoices fixed' as msg, count(*) FROM invoices WHERE organization_id = '00000000-0000-0000-0000-000000000000';
