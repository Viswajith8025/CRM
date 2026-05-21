-- ==============================================================================
-- REPLACE DEPARTMENTS MIGRATION
-- Removes all old departments and inserts the 8 new ones.
-- Safe to run multiple times (idempotent).
-- Run this in Supabase SQL Editor.
-- ==============================================================================

-- Step 1: Wipe old department-related data (cascade safe order)
DELETE FROM department_kpis
WHERE department_id IN (
  SELECT id FROM departments WHERE name IN ('Development', 'Design', 'SEO', 'Sales', 'Content', 'HR & Operations', 'Finance')
);

DELETE FROM department_settings
WHERE department_id IN (
  SELECT id FROM departments WHERE name IN ('Development', 'Design', 'SEO', 'Sales', 'Content', 'HR & Operations', 'Finance')
);

DELETE FROM department_dashboards
WHERE department_id IN (
  SELECT id FROM departments WHERE name IN ('Development', 'Design', 'SEO', 'Sales', 'Content', 'HR & Operations', 'Finance')
);

DELETE FROM department_members
WHERE department_id IN (
  SELECT id FROM departments WHERE name IN ('Development', 'Design', 'SEO', 'Sales', 'Content', 'HR & Operations', 'Finance')
);

-- Step 2: Delete the old departments themselves
DELETE FROM departments
WHERE name IN ('Development', 'Design', 'SEO', 'Sales', 'Content', 'HR & Operations', 'Finance');

-- Step 3: Insert the 8 new departments
-- Replace 'YOUR_ORGANIZATION_ID' with your actual org UUID from the organizations table
-- You can find it by running: SELECT id FROM organizations LIMIT 1;

DO $$
DECLARE
  v_org_id UUID;
BEGIN
  -- Auto-detect your organization ID
  SELECT id INTO v_org_id FROM organizations LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'No organization found. Please create one first.';
  END IF;

  INSERT INTO departments (organization_id, name, slug, description, status)
  VALUES
    (v_org_id, 'Web Developing',    'web_developing',    'Core engineering, frontend, and backend architecture.',       'active'),
    (v_org_id, 'Video Editing',     'video_editing',     'Post-production, rendering, and visual effects.',             'active'),
    (v_org_id, 'Videography',       'videography',       'Camera operations, live shooting, and lighting setups.',      'active'),
    (v_org_id, 'Graphic Designing', 'graphic_designing', 'UI/UX prototypes, branding, and graphic elements.',           'active'),
    (v_org_id, 'Digital Marketing', 'digital_marketing', 'Campaigns, SEO strategy, and paid ad management.',            'active'),
    (v_org_id, 'Content Writer',    'content_writer',    'Editorial pipelines, publishing queues, and review flows.',   'active'),
    (v_org_id, 'CRM',               'crm',               'Client relations, onboarding workflows, and support tickets.','active'),
    (v_org_id, 'BDE',               'bde',               'Business development, sales pipelines, and outreach.',        'active')
  ON CONFLICT (organization_id, slug) DO UPDATE
    SET name = EXCLUDED.name,
        description = EXCLUDED.description,
        status = EXCLUDED.status;

  RAISE NOTICE 'Successfully seeded 8 departments for org: %', v_org_id;
END $$;

-- Verify
SELECT id, name, slug, status FROM departments ORDER BY name;
