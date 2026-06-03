-- ==============================================================================
-- FIX: ADD MISSING COLUMNS TO AUDIT LOGS
-- Resolves error: column "old_value" of relation "audit_logs" does not exist
-- Run in Supabase SQL Editor
-- ==============================================================================

-- 1. Add missing columns if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'old_value') THEN
        ALTER TABLE public.audit_logs ADD COLUMN old_value JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'new_value') THEN
        ALTER TABLE public.audit_logs ADD COLUMN new_value JSONB;
    END IF;
    
    -- Also ensure record_id exists as sometimes it's missing in older schemas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'record_id') THEN
        ALTER TABLE public.audit_logs ADD COLUMN record_id UUID;
    END IF;
END $$;

-- 2. Force schema reload to ensure PostgREST picks up the new columns immediately
NOTIFY pgrst, 'reload schema';
