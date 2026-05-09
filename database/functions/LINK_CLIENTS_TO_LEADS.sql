-- DATA REPAIR: Link existing Clients to Leads by Email and Sync Names
-- Run this in your Supabase SQL Editor

-- 1. Link clients to leads if they share the same email and are not yet linked
UPDATE clients c
SET lead_id = l.id
FROM leads l
WHERE c.email = l.email
AND c.lead_id IS NULL;

-- 2. Sync Client Names to match the Lead Names (as requested)
UPDATE clients c
SET name = l.first_name || ' ' || COALESCE(l.last_name, '')
FROM leads l
WHERE c.lead_id = l.id;

-- 3. Notify PostgREST
NOTIFY pgrst, 'reload schema';
