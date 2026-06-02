-- OPTIMISTIC CONCURRENCY CONTROL (OCC) SETUP
-- This script adds versioning to critical tables to prevent data loss from concurrent edits (Race Conditions).

-- ==============================================================================
-- 1. Add `version` column to critical tables
-- ==============================================================================

-- Adding to Tasks
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tasks' AND column_name='version') THEN
        ALTER TABLE tasks ADD COLUMN version INT DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- Adding to Projects
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='version') THEN
        ALTER TABLE projects ADD COLUMN version INT DEFAULT 1 NOT NULL;
    END IF;
END $$;

-- Adding to Clients
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clients' AND column_name='version') THEN
        ALTER TABLE clients ADD COLUMN version INT DEFAULT 1 NOT NULL;
    END IF;
END $$;


-- ==============================================================================
-- 2. Create the Trigger Function to auto-increment version
-- ==============================================================================
CREATE OR REPLACE FUNCTION increment_version_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.version = OLD.version + 1;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach Trigger to Tasks
DROP TRIGGER IF EXISTS trg_tasks_version ON tasks;
CREATE TRIGGER trg_tasks_version
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION increment_version_trigger();

-- Attach Trigger to Projects
DROP TRIGGER IF EXISTS trg_projects_version ON projects;
CREATE TRIGGER trg_projects_version
BEFORE UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION increment_version_trigger();

-- Attach Trigger to Clients
DROP TRIGGER IF EXISTS trg_clients_version ON clients;
CREATE TRIGGER trg_clients_version
BEFORE UPDATE ON clients
FOR EACH ROW
EXECUTE FUNCTION increment_version_trigger();


-- ==============================================================================
-- 3. Create RPCs for Safe Updates (OCC Enforcement)
-- ==============================================================================

-- Task Update RPC
CREATE OR REPLACE FUNCTION update_task_occ(
    p_task_id UUID,
    p_expected_version INT,
    p_payload JSONB
)
RETURNS SETOF tasks AS $$
DECLARE
    current_version INT;
BEGIN
    -- Check current version
    SELECT version INTO current_version FROM tasks WHERE id = p_task_id;
    
    IF current_version != p_expected_version THEN
        RAISE EXCEPTION 'OCC_CONFLICT: The task has been modified by another user. Expected version %, but got %.', p_expected_version, current_version;
    END IF;

    -- If versions match, perform the update using the payload
    -- (This dynamically updates columns based on the JSON payload)
    RETURN QUERY
    UPDATE tasks 
    SET 
        title = COALESCE((p_payload->>'title')::text, title),
        description = COALESCE((p_payload->>'description')::text, description),
        status = COALESCE((p_payload->>'status')::text, status),
        priority = COALESCE((p_payload->>'priority')::text, priority),
        due_date = COALESCE((p_payload->>'due_date')::timestamp with time zone, due_date)
    WHERE id = p_task_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Project Update RPC
CREATE OR REPLACE FUNCTION update_project_occ(
    p_project_id UUID,
    p_expected_version INT,
    p_payload JSONB
)
RETURNS SETOF projects AS $$
DECLARE
    current_version INT;
BEGIN
    SELECT version INTO current_version FROM projects WHERE id = p_project_id;
    
    IF current_version != p_expected_version THEN
        RAISE EXCEPTION 'OCC_CONFLICT: The project has been modified by another user.';
    END IF;

    RETURN QUERY
    UPDATE projects 
    SET 
        name = COALESCE((p_payload->>'name')::text, name),
        description = COALESCE((p_payload->>'description')::text, description),
        status = COALESCE((p_payload->>'status')::text, status)
    WHERE id = p_project_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;

-- Client Update RPC
CREATE OR REPLACE FUNCTION update_client_occ(
    p_client_id UUID,
    p_expected_version INT,
    p_payload JSONB
)
RETURNS SETOF clients AS $$
DECLARE
    current_version INT;
BEGIN
    SELECT version INTO current_version FROM clients WHERE id = p_client_id;
    
    IF current_version != p_expected_version THEN
        RAISE EXCEPTION 'OCC_CONFLICT: The client profile has been modified by another user.';
    END IF;

    RETURN QUERY
    UPDATE clients 
    SET 
        company_name = COALESCE((p_payload->>'company_name')::text, company_name),
        contact_person = COALESCE((p_payload->>'contact_person')::text, contact_person),
        contact_email = COALESCE((p_payload->>'contact_email')::text, contact_email)
    WHERE id = p_client_id
    RETURNING *;
END;
$$ LANGUAGE plpgsql;
