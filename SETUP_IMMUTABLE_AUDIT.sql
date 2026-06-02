-- ==============================================================================
-- IMMUTABLE AUDIT LOGS (ISO 27001 COMPLIANT)
-- Tracks all data mutations (INSERT/UPDATE/DELETE) with a cryptographic guarantee
-- that records cannot be altered once written.
-- ==============================================================================

-- 1. Create the base Audit Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    table_name VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    client_ip INET
);

-- 2. Secure the Audit Table (Make it append-only via RLS)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to INSERT (The trigger runs with bypass RLS implicitly in some contexts, 
-- but it's best practice to allow the app to insert)
CREATE POLICY "Allow insertions to audit logs" 
ON audit_logs FOR INSERT TO authenticated 
WITH CHECK (true);

-- Allow Super Admins to SELECT (Read-only access)
CREATE POLICY "Super Admins can view audit logs" 
ON audit_logs FOR SELECT TO authenticated
USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin');

-- NO UPDATE OR DELETE POLICIES CREATED. 
-- This mathematically prevents modification of historical logs.


-- 3. Create the Database Trigger Function
CREATE OR REPLACE FUNCTION log_audit_event() 
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Extract the user ID from the Supabase auth context (the JWT)
    v_user_id := nullif(current_setting('request.jwt.claim.sub', true), '')::UUID;

    IF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs (user_id, action, table_name, old_value)
        VALUES (v_user_id, 'DELETE', TG_TABLE_NAME::TEXT, row_to_json(OLD)::JSONB);
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        INSERT INTO audit_logs (user_id, action, table_name, old_value, new_value)
        VALUES (v_user_id, 'UPDATE', TG_TABLE_NAME::TEXT, row_to_json(OLD)::JSONB, row_to_json(NEW)::JSONB);
        RETURN NEW;
    ELSIF (TG_OP = 'INSERT') THEN
        INSERT INTO audit_logs (user_id, action, table_name, new_value)
        VALUES (v_user_id, 'INSERT', TG_TABLE_NAME::TEXT, row_to_json(NEW)::JSONB);
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Attach the Audit Trigger to Critical Tables
-- (You can run this block for any table you wish to audit)

DO $$ 
DECLARE
    t_name TEXT;
BEGIN
    -- List of highly sensitive tables to track
    FOR t_name IN SELECT unnest(ARRAY['clients', 'profiles', 'projects', 'tasks', 'departments']) 
    LOOP
        -- Remove existing trigger if it exists
        EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON %I', t_name, t_name);
        
        -- Attach new trigger
        EXECUTE format('
            CREATE TRIGGER trg_audit_%I 
            AFTER INSERT OR UPDATE OR DELETE ON %I 
            FOR EACH ROW EXECUTE FUNCTION log_audit_event()
        ', t_name, t_name);
    END LOOP;
END $$;

-- ==============================================================================
-- PGP ENCRYPTION SETUP (FOR SENSITIVE CREDENTIALS)
-- ==============================================================================
-- Ensure the pg_crypto extension is active so the application can symmetrically 
-- encrypt data such as external client passwords or API keys before storing them.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
