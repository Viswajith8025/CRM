-- ==============================================================================
-- REPLACE DEPARTMENTS MIGRATION (SAFE, IDEMPOTENT)
-- Run this in Supabase SQL Editor to wipe old departments and insert the 8 new ones.
-- ==============================================================================

DO $$
DECLARE
  v_org_id UUID;
  v_dept_ids UUID[];
BEGIN
  -- Step 1: Auto-detect your organization ID
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Please create one first.';
  END IF;

  RAISE NOTICE 'Found organization: %', v_org_id;

  -- Step 2: Get IDs of old departments to clean up their children
  SELECT ARRAY(
    SELECT id FROM departments
    WHERE organization_id = v_org_id
  ) INTO v_dept_ids;

  -- Step 3: Wipe child records first (FK safe order)
  IF v_dept_ids IS NOT NULL AND array_length(v_dept_ids, 1) > 0 THEN
    DELETE FROM department_kpis      WHERE department_id = ANY(v_dept_ids);
    DELETE FROM department_settings  WHERE department_id = ANY(v_dept_ids);
    DELETE FROM department_dashboards WHERE department_id = ANY(v_dept_ids);
    DELETE FROM department_members   WHERE department_id = ANY(v_dept_ids);
    RAISE NOTICE 'Cleared child records for % old departments.', array_length(v_dept_ids, 1);
  END IF;

  -- Step 4: Delete old departments
  DELETE FROM departments WHERE organization_id = v_org_id;
  RAISE NOTICE 'Deleted all old departments.';

  -- Step 5: Insert the 8 new departments
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

  RAISE NOTICE 'Successfully inserted 8 new departments!';
END $$;

-- Verify the result
SELECT id, name, slug, status, created_at
FROM departments
ORDER BY name;
