-- ==============================================================================
-- REPLACE DEPARTMENTS MIGRATION (FINAL, ROBUST VERSION)
-- Uses the authenticated user's profile org ID - guaranteed to match the frontend.
-- Run this in Supabase SQL Editor.
-- ==============================================================================

DO $$
DECLARE
  v_org_id UUID;
  v_dept_ids UUID[];
BEGIN
  -- Use the FIRST organization found (works for single-tenant setups)
  -- This ensures it matches what the frontend profile.organization_id returns
  SELECT id INTO v_org_id FROM organizations ORDER BY created_at ASC LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Run the org setup first.';
  END IF;

  RAISE NOTICE 'Using organization_id: %', v_org_id;

  -- Collect all existing department IDs for this org
  SELECT ARRAY(SELECT id FROM departments WHERE organization_id = v_org_id)
  INTO v_dept_ids;

  -- Clean up child tables in correct FK order
  IF v_dept_ids IS NOT NULL AND array_length(v_dept_ids, 1) > 0 THEN
    DELETE FROM department_kpis       WHERE department_id = ANY(v_dept_ids);
    DELETE FROM department_settings   WHERE department_id = ANY(v_dept_ids);
    DELETE FROM department_dashboards WHERE department_id = ANY(v_dept_ids);
    DELETE FROM department_members    WHERE department_id = ANY(v_dept_ids);
    RAISE NOTICE 'Removed child records for % old departments.', array_length(v_dept_ids, 1);
  END IF;

  -- Delete old departments
  DELETE FROM departments WHERE organization_id = v_org_id;
  RAISE NOTICE 'Deleted all old departments for org.';

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

  RAISE NOTICE '✅ Successfully inserted 8 new departments for org: %', v_org_id;
END $$;

-- ==============================================================================
-- VERIFY: You should see 8 rows below after running the above
-- ==============================================================================
SELECT 
  name, 
  slug, 
  status,
  organization_id
FROM departments 
ORDER BY name;
