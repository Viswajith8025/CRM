-- ==============================================================================
-- CRM TRANSACTIONAL CONVERSION (ACID HARDENING)
-- ==============================================================================
-- This updates the lead-to-client conversion RPC to strictly enforce concurrency 
-- protection using ROW-LEVEL LOCKING (FOR UPDATE) to prevent race conditions.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.convert_lead_to_client(
    p_lead_id UUID,
    p_org_id UUID,
    p_converted_by UUID
)
RETURNS UUID AS $$
DECLARE
    v_client_id UUID;
    v_lead_name TEXT;
    v_lead_email TEXT;
    v_lead_phone TEXT;
    v_lead_company TEXT;
    v_lead_user_id UUID;
    v_lead_status TEXT;
    v_project_id UUID;
BEGIN
    -- 1. ROW LEVEL LOCK: Prevent concurrent requests from reading this lead mid-transaction
    SELECT 
        status,
        first_name || ' ' || COALESCE(last_name, ''),
        email, 
        phone, 
        company,
        user_id
    INTO 
        v_lead_status,
        v_lead_name, 
        v_lead_email, 
        v_lead_phone, 
        v_lead_company,
        v_lead_user_id
    FROM public.leads 
    WHERE id = p_lead_id 
      AND organization_id = p_org_id
    FOR UPDATE; -- Blocks concurrent transactions from mutating this lead

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lead not found or organization mismatch.';
    END IF;

    -- 2. IDEMPOTENCY CHECK
    IF v_lead_status = 'active_client' THEN
        -- Safely return existing client if already converted
        SELECT id INTO v_client_id FROM public.clients WHERE lead_id = p_lead_id;
        IF v_client_id IS NOT NULL THEN
            RETURN v_client_id;
        END IF;
        RAISE EXCEPTION 'Lead is already converted but orphaned. Manual intervention required.';
    END IF;

    -- 3. CREATE THE CLIENT RECORD
    INSERT INTO public.clients (
        organization_id,
        user_id,
        lead_id,
        name,
        email,
        phone,
        service,
        created_at,
        updated_at
    ) VALUES (
        p_org_id,
        COALESCE(v_lead_user_id, p_converted_by),
        p_lead_id,
        COALESCE(v_lead_name, 'Converted Lead'),
        v_lead_email,
        v_lead_phone,
        v_lead_company,
        NOW(),
        NOW()
    ) RETURNING id INTO v_client_id;

    -- 4. UPDATE THE LEAD RECORD (Atomically bound to client insert)
    UPDATE public.leads 
    SET 
        status = 'active_client',
        converted_at = NOW(),
        converted_by = p_converted_by,
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- 5. INITIALIZE DEFAULT PROJECT
    -- The plan mandated project initialization upon conversion
    INSERT INTO public.projects (
        organization_id,
        name,
        description,
        client_id,
        status,
        created_at,
        updated_at
    ) VALUES (
        p_org_id,
        v_lead_company || ' - Onboarding',
        'Auto-generated project from Lead Conversion.',
        v_client_id,
        'planning',
        NOW(),
        NOW()
    ) RETURNING id INTO v_project_id;

    -- 6. LOG THE AUDIT EVENT
    INSERT INTO public.activities (
        user_id,
        organization_id,
        action,
        target_type,
        target_id,
        target_name,
        severity,
        metadata
    ) VALUES (
        p_converted_by,
        p_org_id,
        'CLIENT_ACTIVATED',
        'lead',
        p_lead_id,
        v_lead_name,
        'info',
        jsonb_build_object(
            'description', 'Lead successfully converted to client in ACID transaction',
            'client_id', v_client_id,
            'project_id', v_project_id,
            'converted_at', NOW()
        )
    );

    RETURN v_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify schema refresh
NOTIFY pgrst, 'reload schema';
