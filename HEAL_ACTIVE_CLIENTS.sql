-- HEAL_ACTIVE_CLIENTS.sql
-- This script ensures that any leads marked as 'active_client' have a corresponding record in the 'clients' table.
-- It also fixes the status of leads already linked to clients.

-- 1. Promote 'active_client' leads to the clients table if they are missing
INSERT INTO clients (organization_id, name, email, phone, lead_id, user_id)
SELECT 
    l.organization_id,
    TRIM(CONCAT(l.first_name, ' ', l.last_name)) as name,
    l.email,
    l.phone,
    l.id as lead_id,
    l.user_id
FROM leads l
LEFT JOIN clients c ON l.id = c.lead_id
WHERE l.status = 'active_client'
  AND c.id IS NULL;

-- 2. Ensure leads linked to clients are marked as 'active_client'
-- This fixes the case where a client exists but the lead is still stuck in 'negotiation' etc.
UPDATE leads
SET status = 'active_client'
WHERE id IN (SELECT lead_id FROM clients WHERE lead_id IS NOT NULL)
  AND status != 'active_client';

-- 3. Verify counts
SELECT 
    (SELECT count(*) FROM leads WHERE status = 'active_client') as active_leads_count,
    (SELECT count(*) FROM clients) as total_clients_count;
