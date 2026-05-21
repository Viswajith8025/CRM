-- ==============================================================================
-- REPLACE DEPARTMENTS - FINAL WORKING VERSION
-- This version inserts the departments for EVERY organization in the system
-- guaranteeing that your profile will see them regardless of which org you are in.
-- Run in Supabase SQL Editor.
-- ==============================================================================

DO $$
DECLARE
  v_org_record RECORD;
  v_dept_ids UUID[];
BEGIN

  -- Loop through every organization in the system
  FOR v_org_record IN SELECT id FROM organizations LOOP
    
    RAISE NOTICE 'Processing organization_id: %', v_org_record.id;

    -- Collect existing department IDs for this org
    SELECT ARRAY(SELECT id FROM departments WHERE organization_id = v_org_record.id)
    INTO v_dept_ids;

    -- Clean child tables (FK-safe order)
    IF v_dept_ids IS NOT NULL AND array_length(v_dept_ids, 1) > 0 THEN
      DELETE FROM department_kpis       WHERE department_id = ANY(v_dept_ids);
      DELETE FROM department_settings   WHERE department_id = ANY(v_dept_ids);
      DELETE FROM department_dashboards WHERE department_id = ANY(v_dept_ids);
      DELETE FROM department_members    WHERE department_id = ANY(v_dept_ids);
    END IF;

    -- Delete old departments
    DELETE FROM departments WHERE organization_id = v_org_record.id;

    -- Insert the 8 new departments for this org
    INSERT INTO departments (organization_id, name, slug, description, status)
    VALUES
      (v_org_record.id, 'Web Developing',    'web_developing',    'Core engineering, frontend, and backend architecture.',        'active'),
      (v_org_record.id, 'Video Editing',     'video_editing',     'Post-production, rendering, and visual effects.',              'active'),
      (v_org_record.id, 'Videography',       'videography',       'Camera operations, live shooting, and lighting setups.',       'active'),
      (v_org_record.id, 'Graphic Designing', 'graphic_designing', 'UI/UX prototypes, branding, and graphic elements.',            'active'),
      (v_org_record.id, 'Digital Marketing', 'digital_marketing', 'Campaigns, SEO strategy, and paid ad management.',             'active'),
      (v_org_record.id, 'Content Writer',    'content_writer',    'Editorial pipelines, publishing queues, and review flows.',    'active'),
      (v_org_record.id, 'CRM',               'crm',               'Client relations, onboarding workflows, and support tickets.', 'active'),
      (v_org_record.id, 'BDE',               'bde',               'Business development, sales pipelines, and outreach.',         'active');

    RAISE NOTICE '✅ 8 departments inserted for org: %', v_org_record.id;
    
  END LOOP;
  
  RAISE NOTICE 'Done processing all organizations!';
END $$;

-- Verify
SELECT name, slug, organization_id FROM departments ORDER BY name;
