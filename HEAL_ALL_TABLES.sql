-- Master Healing Script: Align all data to the Lead's or Project's Organization
-- Run this if you are getting 409 Conflicts or records are "disappearing"

-- 1. Align Projects to their Client's organization
UPDATE projects p
SET organization_id = c.organization_id
FROM clients c
WHERE p.client_id = c.id
AND p.organization_id != c.organization_id;

-- 2. Align Project Members to their Project's organization
UPDATE project_members pm
SET organization_id = p.organization_id
FROM projects p
WHERE pm.project_id = p.id
AND pm.organization_id != p.organization_id;

-- 3. Align Tasks to their Project's organization
UPDATE tasks t
SET organization_id = p.organization_id
FROM projects p
WHERE t.project_id = p.id
AND t.organization_id != p.organization_id;

-- 4. Align Clients to their Lead's organization (if converted)
UPDATE clients c
SET organization_id = l.organization_id
FROM leads l
WHERE c.lead_id = l.id
AND c.organization_id != l.organization_id;

-- 5. Align Notifications to the User's organization
UPDATE notifications n
SET organization_id = p.organization_id
FROM profiles p
WHERE n.user_id = p.id
AND n.organization_id != p.organization_id;

-- 6. Force any remaining NULL or mismatched records in critical tables to a valid org 
NOTIFY pgrst, 'reload schema';
