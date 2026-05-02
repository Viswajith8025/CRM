-- ==============================================================================
-- HEAL CLIENTS TABLE: ADD MISSING COLUMNS
-- ==============================================================================
-- Run this to fix the "service column does not exist" error.
-- ==============================================================================

ALTER TABLE clients ADD COLUMN IF NOT EXISTS service TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS isVirtual BOOLEAN DEFAULT false;

-- Now retry the Test Client creation
DO $$ 
DECLARE 
  target_user_id UUID;
BEGIN
  -- Get the first profile found
  SELECT id INTO target_user_id FROM profiles LIMIT 1;
  
  IF target_user_id IS NOT NULL THEN
    -- Create the Test Client
    INSERT INTO clients (user_id, name, email, service, isVirtual)
    VALUES (target_user_id, 'RECOVERY TEST CLIENT', 'test@recovery.com', 'Database Fix', false)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
