-- ==============================================================================
-- SEED LEAVE POLICIES AND ALLOCATE BALANCES FOR ALL EMPLOYEES
--
-- Problem:
--   Leave types exist but have no policies (yearly_limit = 0).
--   Employees have no leave_balance rows.
--   The trigger correctly blocks submission when allocated = 0.
--
-- Fix:
--   1. Seed default leave policies for every org (if not already set).
--   2. Auto-allocate current-year balances for every active employee.
-- ==============================================================================

DO $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM now())::INTEGER;
BEGIN

  -- ─── STEP 1: Seed leave policies (yearly limits) for all orgs ──────────────
  -- Paid Leave: 12 days/year
  INSERT INTO public.leave_policies (organization_id, leave_type_id, yearly_limit, approval_required)
  SELECT lt.organization_id, lt.id, 12, true
  FROM public.leave_types lt
  WHERE lt.name = 'Paid Leave'
  ON CONFLICT (organization_id, leave_type_id) DO NOTHING;

  -- Sick Leave: 6 days/year
  INSERT INTO public.leave_policies (organization_id, leave_type_id, yearly_limit, approval_required)
  SELECT lt.organization_id, lt.id, 6, false
  FROM public.leave_types lt
  WHERE lt.name = 'Sick Leave'
  ON CONFLICT (organization_id, leave_type_id) DO NOTHING;

  -- Casual Leave: 6 days/year
  INSERT INTO public.leave_policies (organization_id, leave_type_id, yearly_limit, approval_required)
  SELECT lt.organization_id, lt.id, 6, true
  FROM public.leave_types lt
  WHERE lt.name = 'Casual Leave'
  ON CONFLICT (organization_id, leave_type_id) DO NOTHING;

  -- Earned Leave / Annual Leave: 18 days/year
  INSERT INTO public.leave_policies (organization_id, leave_type_id, yearly_limit, approval_required)
  SELECT lt.organization_id, lt.id, 18, true
  FROM public.leave_types lt
  WHERE lt.name IN ('Earned Leave', 'Annual Leave', 'Privilege Leave')
  ON CONFLICT (organization_id, leave_type_id) DO NOTHING;

  -- Unpaid Leave: 30 days/year (no real cap, always requires approval)
  INSERT INTO public.leave_policies (organization_id, leave_type_id, yearly_limit, approval_required)
  SELECT lt.organization_id, lt.id, 30, true
  FROM public.leave_types lt
  WHERE lt.name = 'Unpaid Leave'
  ON CONFLICT (organization_id, leave_type_id) DO NOTHING;

  -- Catch-all: any other leave types with no policy yet → set 12 days
  INSERT INTO public.leave_policies (organization_id, leave_type_id, yearly_limit, approval_required)
  SELECT lt.organization_id, lt.id, 12, true
  FROM public.leave_types lt
  WHERE lt.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.leave_policies lp
      WHERE lp.leave_type_id = lt.id
    )
  ON CONFLICT (organization_id, leave_type_id) DO NOTHING;


  -- ─── STEP 2: Auto-allocate current-year balances for all active employees ──
  -- For every active profile × every active leave type in their org,
  -- create a leave_balance row if one doesn't already exist.
  INSERT INTO public.leave_balances (organization_id, user_id, leave_type_id, year, allocated, used, pending)
  SELECT
    p.organization_id,
    p.id AS user_id,
    lt.id AS leave_type_id,
    v_year,
    COALESCE(lp.yearly_limit, 12) AS allocated,  -- fallback: 12 days if no policy
    0,   -- used
    0    -- pending
  FROM public.profiles p
  INNER JOIN public.leave_types lt
    ON lt.organization_id = p.organization_id
    AND lt.is_active = true
  LEFT JOIN public.leave_policies lp
    ON lp.leave_type_id = lt.id
    AND lp.organization_id = p.organization_id
  WHERE p.organization_id IS NOT NULL
  ON CONFLICT (user_id, leave_type_id, year) DO NOTHING;

  RAISE NOTICE 'Leave policies and balances seeded for year %.', v_year;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
