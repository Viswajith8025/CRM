-- ATOMIC MULTI-TABLE TRANSACTIONS FOR LEAD CONVERSION
-- This script safely wraps the Lead -> Client -> Project creation into a single, unbreakable transaction.

-- ==============================================================================
-- 1. Create the Atomic Conversion RPC
-- ==============================================================================
CREATE OR REPLACE FUNCTION convert_lead_to_client_project(
    p_lead_id UUID,
    p_org_id UUID,
    p_converted_by UUID,
    p_project_name TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_lead_status TEXT;
    v_lead_data RECORD;
    v_new_client_id UUID;
    v_new_project_id UUID;
BEGIN
    -- 1. Lock the lead row for update to prevent concurrent conversions (Race Condition Defense)
    SELECT * INTO v_lead_data FROM leads WHERE id = p_lead_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LEAD_NOT_FOUND: The specified lead does not exist.';
    END IF;

    IF v_lead_data.status = 'converted' THEN
        RAISE EXCEPTION 'ALREADY_CONVERTED: This lead has already been converted.';
    END IF;

    -- 2. Update Lead Status
    UPDATE leads 
    SET 
        status = 'converted',
        updated_at = now()
    WHERE id = p_lead_id;

    -- 3. Create the Client Record
    INSERT INTO clients (
        organization_id, 
        company_name, 
        contact_person, 
        contact_email, 
        contact_phone, 
        status, 
        created_at
    ) VALUES (
        p_org_id,
        COALESCE(v_lead_data.company, v_lead_data.name), -- Fallback to person name if company is null
        v_lead_data.name,
        v_lead_data.email,
        v_lead_data.phone,
        'active',
        now()
    )
    RETURNING id INTO v_new_client_id;

    -- 4. Create the Project Record
    INSERT INTO projects (
        organization_id,
        client_id,
        name,
        description,
        status,
        created_at
    ) VALUES (
        p_org_id,
        v_new_client_id,
        p_project_name,
        'Project generated from lead conversion.',
        'planning',
        now()
    )
    RETURNING id INTO v_new_project_id;

    -- If any step above fails, PL/pgSQL automatically ROLLBACKS the entire transaction.
    -- No orphaned clients or hanging leads will ever be created.

    RETURN json_build_object(
        'client_id', v_new_client_id,
        'project_id', v_new_project_id,
        'message', 'Conversion successful'
    );
END;
$$ LANGUAGE plpgsql;


-- ==============================================================================
-- 2. DATA INTEGRITY & AUDIT QUERIES
-- Run these manually to check for historical anomalies
-- ==============================================================================

/*
-- Check 1: Find leads marked as 'converted' that have NO matching client via email or phone.
-- (This indicates a past failure where the client insert failed but the lead updated)
SELECT l.id, l.name, l.email 
FROM leads l
LEFT JOIN clients c ON c.contact_email = l.email
WHERE l.status = 'converted' AND c.id IS NULL;

-- Fix 1: Revert phantom conversions back to 'won' so they can be re-processed
UPDATE leads 
SET status = 'won'
WHERE id IN (
    SELECT l.id 
    FROM leads l
    LEFT JOIN clients c ON c.contact_email = l.email
    WHERE l.status = 'converted' AND c.id IS NULL
);

-- Check 2: Find Clients that have absolutely NO active or planning projects.
-- (This indicates a past failure where Client succeeded, but Project creation failed)
SELECT c.id, c.company_name 
FROM clients c
LEFT JOIN projects p ON p.client_id = c.id
WHERE p.id IS NULL;
*/
