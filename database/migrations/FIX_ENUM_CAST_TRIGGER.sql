-- ==============================================================================
-- HOTFIX: FIX POSTGRES ENUM CASTING BUG IN TRIGGERS
-- Resolves "invalid input value for enum lead_status: 'converted'" (22P02)
-- ==============================================================================

BEGIN;

-- 1. Fix sync_lead_to_client
CREATE OR REPLACE FUNCTION public.sync_lead_to_client()
RETURNS TRIGGER SECURITY DEFINER AS $$
DECLARE
  v_client_id UUID;
  v_client_name TEXT;
BEGIN
  -- Prevent infinite trigger recursion (ping-pong between leads and clients)
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Use ::text casting to prevent postgres enum validation errors when checking 'converted'
  IF NEW.status::text IN ('active_client', 'converted') THEN
    
    -- Construct full name or fallback to company
    IF NEW.first_name IS NOT NULL THEN
      v_client_name := TRIM(CONCAT(NEW.first_name, ' ', COALESCE(NEW.last_name, '')));
    ELSE
      v_client_name := COALESCE(NEW.company, 'Unknown Client');
    END IF;

    -- Check if client already exists for this lead
    SELECT id INTO v_client_id FROM public.clients WHERE lead_id = NEW.id LIMIT 1;
    
    -- If not by lead_id, try by email
    IF v_client_id IS NULL AND NEW.email IS NOT NULL THEN
      SELECT id INTO v_client_id FROM public.clients WHERE email = NEW.email AND organization_id = NEW.organization_id LIMIT 1;
    END IF;

    IF v_client_id IS NULL THEN
      -- Insert new client
      INSERT INTO public.clients (
        organization_id, 
        lead_id, 
        name, 
        email, 
        phone, 
        contract_value,
        user_id
      )
      VALUES (
        NEW.organization_id, 
        NEW.id, 
        v_client_name, 
        NEW.email, 
        NEW.phone, 
        NEW.value,
        NEW.user_id
      );
    ELSE
      -- Update existing client
      UPDATE public.clients 
      SET 
        name = v_client_name,
        email = COALESCE(NEW.email, public.clients.email),
        phone = COALESCE(NEW.phone, public.clients.phone),
        contract_value = COALESCE(NEW.value, public.clients.contract_value)
      WHERE id = v_client_id AND lead_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix audit log trigger (if it exists)
CREATE OR REPLACE FUNCTION public.audit_lead_status_changes()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  -- Prevent recursion
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  -- Log conversion
  IF NEW.status::text IN ('active_client', 'converted') AND OLD.status::text NOT IN ('active_client', 'converted') THEN
    INSERT INTO public.activities (
      organization_id,
      user_id,
      action,
      target_type,
      target_name,
      target_id,
      metadata
    ) VALUES (
      NEW.organization_id,
      NEW.user_id,
      'converted',
      'Lead',
      TRIM(CONCAT(NEW.first_name, ' ', COALESCE(NEW.last_name, ''))),
      NEW.id::text,
      jsonb_build_object('message', 'Lead converted to Client', 'lead_title', TRIM(CONCAT(NEW.first_name, ' ', COALESCE(NEW.last_name, ''))))
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
