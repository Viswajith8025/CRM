-- ==============================================================================
-- REPLACE DEPARTMENTS - FINAL WORKING VERSION
-- This version uses the profiles table to get the correct org_id
-- that matches what the frontend uses. Run in Supabase SQL Editor.
-- ==============================================================================

DO $$
DECLARE
  v_org_id UUID;
  v_dept_ids UUID[];
  v_count INT;
BEGIN
  -- Get org_id from profiles table (same source the frontend uses)
  SELECT organization_id INTO v_org_id 
  FROM profiles 
  WHERE organization_id IS NOT NULL 
  LIMIT 1;

  IF v_org_id IS NULL THEN
    -- Try organizations table as fallback
    SELECT id INTO v_org_id FROM organizations LIMIT 1;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Cannot determine organization ID. Make sure profiles.organization_id is set.';
  END IF;

  RAISE NOTICE 'Using organization_id: %', v_org_id;

  -- Collect existing department IDs
  SELECT ARRAY(SELECT id FROM departments WHERE organization_id = v_org_id)
  INTO v_dept_ids;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Clean child tables (FK-safe order)
  IF v_dept_ids IS NOT NULL AND array_length(v_dept_ids, 1) > 0 THEN
    DELETE FROM department_kpis       WHERE department_id = ANY(v_dept_ids);
    DELETE FROM department_settings   WHERE department_id = ANY(v_dept_ids);
    DELETE FROM department_dashboards WHERE department_id = ANY(v_dept_ids);
    DELETE FROM department_members    WHERE department_id = ANY(v_dept_ids);
    RAISE NOTICE 'Cleared child records.';
  END IF;

  -- Delete old departments
  DELETE FROM departments WHERE organization_id = v_org_id;
  RAISE NOTICE 'Deleted old departments.';

  -- Insert the 8 new departments
  INSERT INTO departments (organization_id, name, slug, description, status)
  VALUES
    (v_org_id, 'Web Developing',    'web_developing',    'Core engineering, frontend, and backend architecture.',        'active'),
    (v_org_id, 'Video Editing',     'video_editing',     'Post-production, rendering, and visual effects.',              'active'),
    (v_org_id, 'Videography',       'videography',       'Camera operations, live shooting, and lighting setups.',       'active'),
    (v_org_id, 'Graphic Designing', 'graphic_designing', 'UI/UX prototypes, branding, and graphic elements.',            'active'),
    (v_org_id, 'Digital Marketing', 'digital_marketing', 'Campaigns, SEO strategy, and paid ad management.',             'active'),
    (v_org_id, 'Content Writer',    'content_writer',    'Editorial pipelines, publishing queues, and review flows.',    'active'),
    (v_org_id, 'CRM',               'crm',               'Client relations, onboarding workflows, and support tickets.', 'active'),
    (v_org_id, 'BDE',               'bde',               'Business development, sales pipelines, and outreach.',         'active');

  RAISE NOTICE '✅ Done! 8 departments inserted for org: %', v_org_id;
END $$;

-- Verify
SELECT name, slug, organization_id FROM departments ORDER BY name;
