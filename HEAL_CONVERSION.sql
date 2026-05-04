-- HEALING SCRIPT: Sync organization_id between Leads and Clients
-- This fixes the 409 Conflict when converting leads.

-- 1. Update any clients that are missing their lead's organization_id
UPDATE clients c
SET organization_id = l.organization_id
FROM leads l
WHERE c.lead_id = l.id
AND c.organization_id != l.organization_id;

-- 2. Ensure all clients have at least the default org if still null (safety)
UPDATE clients SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;

-- 3. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
