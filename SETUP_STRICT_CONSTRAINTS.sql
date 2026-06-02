-- ==============================================================================
-- STRICT DATABASE CONSTRAINTS MIGRATION
-- Prevents orphaned records and frontend crashes caused by unhandled deletions.
-- ==============================================================================

DO $$ 
DECLARE
  rc RECORD;
BEGIN
  -- ----------------------------------------------------------------------------
  -- 1. DEPARTMENTS -> TEAM LEADS (PROFILES)
  -- If a user is deleted, keep the department but clear the team lead assignment.
  -- ----------------------------------------------------------------------------
  FOR rc IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc 
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name 
    WHERE tc.table_name = 'departments' 
      AND kcu.column_name = 'leader_id' 
      AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE departments DROP CONSTRAINT ' || rc.constraint_name;
  END LOOP;
  
  -- Add robust constraint
  ALTER TABLE departments 
  ADD CONSTRAINT departments_leader_id_fkey 
  FOREIGN KEY (leader_id) REFERENCES profiles(id) ON DELETE SET NULL;





  -- ----------------------------------------------------------------------------
  -- 3. DEPARTMENT MEMBERS -> DEPARTMENTS (CASCADE)
  -- If a department is deleted, completely destroy the membership bridge records.
  -- ----------------------------------------------------------------------------
  FOR rc IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc 
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name 
    WHERE tc.table_name = 'department_members' 
      AND kcu.column_name = 'department_id' 
      AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE department_members DROP CONSTRAINT ' || rc.constraint_name;
  END LOOP;
  
  ALTER TABLE department_members 
  ADD CONSTRAINT department_members_department_id_fkey 
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;


  -- ----------------------------------------------------------------------------
  -- 4. DEPARTMENT MEMBERS -> PROFILES (CASCADE)
  -- If an employee is deleted, completely destroy their department membership.
  -- ----------------------------------------------------------------------------
  FOR rc IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc 
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name 
    WHERE tc.table_name = 'department_members' 
      AND kcu.column_name = 'profile_id' 
      AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE department_members DROP CONSTRAINT ' || rc.constraint_name;
  END LOOP;
  
  ALTER TABLE department_members 
  ADD CONSTRAINT department_members_profile_id_fkey 
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;


  -- ----------------------------------------------------------------------------
  -- 5. PROJECTS -> DEPARTMENTS (SET NULL)
  -- If a department is deleted, move the project to "Global" scope.
  -- ----------------------------------------------------------------------------
  FOR rc IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc 
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name 
    WHERE tc.table_name = 'projects' 
      AND kcu.column_name = 'department_id' 
      AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE projects DROP CONSTRAINT ' || rc.constraint_name;
  END LOOP;

  ALTER TABLE projects 
  ADD CONSTRAINT projects_department_id_fkey 
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;


  -- ----------------------------------------------------------------------------
  -- 6. DEPARTMENT KPIs -> DEPARTMENTS (CASCADE)
  -- If a department is deleted, destroy its KPIs.
  -- ----------------------------------------------------------------------------
  FOR rc IN (
    SELECT tc.constraint_name 
    FROM information_schema.table_constraints tc 
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name 
    WHERE tc.table_name = 'department_kpis' 
      AND kcu.column_name = 'department_id' 
      AND tc.constraint_type = 'FOREIGN KEY'
  ) LOOP
    EXECUTE 'ALTER TABLE department_kpis DROP CONSTRAINT ' || rc.constraint_name;
  END LOOP;

  ALTER TABLE department_kpis 
  ADD CONSTRAINT department_kpis_department_id_fkey 
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE;


END $$;
