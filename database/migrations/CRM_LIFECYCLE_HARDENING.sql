-- ==============================================================================
-- CRM ENTERPRISE LIFECYCLE: Lead-to-Client Atomic Conversion
-- ==============================================================================

-- 1. Extend Lead Schema with Conversion Tracking
ALTER TABLE public.leads 
    ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS converted_by UUID REFERENCES auth.users(id),
    ADD COLUMN IF NOT EXISTS conversion_notes TEXT;

-- 2. Enforce Client Uniqueness (One Lead = One Client)
-- Ensure any existing duplicates are handled manually, but enforce for new ones.
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_lead_id_unique;
ALTER TABLE public.clients ADD CONSTRAINT clients_lead_id_unique UNIQUE (lead_id);

-- 3. Atomic Conversion RPC
-- Handles client creation, lead status update, and activity logging in one transaction.
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
BEGIN
    -- 1. Check if lead exists and is NOT already converted
    SELECT 
        first_name || ' ' || COALESCE(last_name, ''),
        email, 
        phone, 
        company,
        user_id
    INTO 
        v_lead_name, 
        v_lead_email, 
        v_lead_phone, 
        v_lead_company,
        v_lead_user_id
    FROM public.leads 
    WHERE id = p_lead_id 
      AND organization_id = p_org_id
      AND (status != 'active_client' OR status IS NULL);

    IF NOT FOUND THEN
        -- Check if it's already a client
        SELECT id INTO v_client_id FROM public.clients WHERE lead_id = p_lead_id;
        IF v_client_id IS NOT NULL THEN
            RETURN v_client_id;
        END IF;
        RAISE EXCEPTION 'Lead not found or already converted.';
    END IF;

    -- 2. Create the Client Record
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

    -- 3. Update the Lead Record
    UPDATE public.leads 
    SET 
        status = 'active_client',
        converted_at = NOW(),
        converted_by = p_converted_by,
        updated_at = NOW()
    WHERE id = p_lead_id;

    -- 4. Log the Audit Event
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
            'description', 'Lead successfully converted to client',
            'client_id', v_client_id,
            'converted_at', NOW()
        )
    );

    RETURN v_client_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Cleanup Helper: Move any existing 'active_client' leads to have converted metadata
UPDATE public.leads 
SET converted_at = created_at 
WHERE status = 'active_client' AND converted_at IS NULL;

-- Notify schema refresh
NOTIFY pgrst, 'reload schema';
