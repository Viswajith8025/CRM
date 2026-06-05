-- ==============================================================================
-- FIX MEDIUM PRIORITY ISSUES
-- ==============================================================================

-- 1. Soft-delete RLS conflict on leads
-- Ensure migration scripts use DROP POLICY IF EXISTS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hide soft-deleted leads" ON public.leads;
CREATE POLICY "Hide soft-deleted leads" ON public.leads
FOR SELECT
USING (deleted_at IS NULL);


-- 3. sync_client_to_lead trigger uses pg_trigger_depth() > 1 -> Update guard to > 0
CREATE OR REPLACE FUNCTION public.sync_lead_to_client()
RETURNS TRIGGER SECURITY DEFINER AS $$
DECLARE
  v_client_id UUID;
  v_client_name TEXT;
BEGIN
  -- Prevent infinite trigger recursion (ping-pong between leads and clients)
  -- Changed > 1 to > 0 to prevent double execution
  IF pg_trigger_depth() > 0 THEN
    RETURN NEW;
  END IF;

  -- We trigger this if status becomes 'active_client' or 'converted'
  IF NEW.status IN ('active_client', 'converted') THEN
    
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
      -- Update existing client to ensure it's in sync, but only if we have a lead_id match to avoid overwriting direct clients too aggressively
      UPDATE public.clients
      SET 
        lead_id = NEW.id,
        name = v_client_name,
        email = COALESCE(NEW.email, email),
        phone = COALESCE(NEW.phone, phone),
        contract_value = COALESCE(NEW.value, contract_value)
      WHERE id = v_client_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.sync_client_to_lead()
RETURNS TRIGGER SECURITY DEFINER AS $$
DECLARE
  v_lead_id UUID;
  v_first_name TEXT;
  v_last_name TEXT;
  v_space_idx INT;
BEGIN
  -- Prevent infinite trigger recursion (ping-pong)
  -- Changed > 1 to > 0 to prevent double execution
  IF pg_trigger_depth() > 0 THEN
    RETURN NEW;
  END IF;

  -- If a client is created but has no lead_id, it was created directly (e.g. Onboarding Form)
  -- We must create a corresponding 'active_client' lead so it appears in the Kanban board.
  IF NEW.lead_id IS NULL THEN
    
    -- Check if lead already exists by email
    IF NEW.email IS NOT NULL THEN
      SELECT id INTO v_lead_id FROM public.leads WHERE email = NEW.email AND organization_id = NEW.organization_id LIMIT 1;
    END IF;

    IF v_lead_id IS NULL THEN
      -- Parse Name into first and last
      v_space_idx := POSITION(' ' IN NEW.name);
      IF v_space_idx > 0 THEN
        v_first_name := SUBSTRING(NEW.name FROM 1 FOR v_space_idx - 1);
        v_last_name := SUBSTRING(NEW.name FROM v_space_idx + 1);
      ELSE
        v_first_name := NEW.name;
        v_last_name := '';
      END IF;

      -- Insert into leads
      INSERT INTO public.leads (
        organization_id,
        first_name,
        last_name,
        email,
        phone,
        company,
        status,
        value,
        source,
        user_id
      )
      VALUES (
        NEW.organization_id,
        v_first_name,
        v_last_name,
        NEW.email,
        NEW.phone,
        NEW.name, -- fallback company to name
        'active_client', -- forces it into the converted column
        NEW.contract_value,
        'Direct Client',
        NEW.user_id
      )
      RETURNING id INTO v_lead_id;

      -- Assign the new lead_id directly to the NEW record (BEFORE INSERT)
      NEW.lead_id := v_lead_id;
    ELSE
      -- Lead exists, just link it
      NEW.lead_id := v_lead_id;
      
      -- Temporarily disable triggers or rely on trigger_depth for the lead update
      UPDATE public.leads SET status = 'active_client' WHERE id = v_lead_id AND status != 'active_client';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
