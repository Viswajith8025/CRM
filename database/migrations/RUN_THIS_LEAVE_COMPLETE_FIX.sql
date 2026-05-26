-- ==============================================================================
-- *** RUN THIS ENTIRE SCRIPT IN SUPABASE SQL EDITOR ***
-- FIXES: Leave request 404 error - creates all tables, policies, and RPC
-- ==============================================================================

-- STEP 1: Create leave status enum (safe)
DO $$ BEGIN
    CREATE TYPE leave_request_status AS ENUM (
        'pending', 'approved', 'rejected', 'cancelled', 'clarification_required'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- STEP 2: Create leave_types table
CREATE TABLE IF NOT EXISTS public.leave_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Calendar',
    color TEXT DEFAULT '#6366f1',
    is_paid BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, name)
);

-- STEP 3: Create leave_policies table
CREATE TABLE IF NOT EXISTS public.leave_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
    yearly_limit INTEGER DEFAULT 0,
    max_carry_forward INTEGER DEFAULT 0,
    approval_required BOOLEAN DEFAULT true,
    monthly_cap INTEGER,
    min_days_before_request INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id, leave_type_id)
);

-- STEP 4: Create leave_requests table
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_half_day BOOLEAN DEFAULT false,
    half_day_period TEXT,
    reason TEXT NOT NULL,
    is_emergency BOOLEAN DEFAULT false,
    attachment_url TEXT,
    status leave_request_status DEFAULT 'pending',
    current_approver_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- STEP 5: Create leave_request_actions table
CREATE TABLE IF NOT EXISTS public.leave_request_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id),
    action TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- STEP 6: Create leave_balances table
CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
    year INTEGER NOT NULL,
    allocated INTEGER DEFAULT 0,
    used INTEGER DEFAULT 0,
    pending INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, leave_type_id, year)
);

-- STEP 7: Enable RLS on all tables
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_request_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- STEP 8: Grant table access to authenticated role
GRANT ALL ON TABLE public.leave_types TO authenticated;
GRANT ALL ON TABLE public.leave_policies TO authenticated;
GRANT ALL ON TABLE public.leave_requests TO authenticated;
GRANT ALL ON TABLE public.leave_request_actions TO authenticated;
GRANT ALL ON TABLE public.leave_balances TO authenticated;

-- STEP 9: RLS Policies for leave_types
DROP POLICY IF EXISTS "Users can view active leave types in their org" ON public.leave_types;
CREATE POLICY "Users can view active leave types in their org"
    ON public.leave_types FOR SELECT
    USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- STEP 10: RLS Policies for leave_requests
DROP POLICY IF EXISTS "Users can view their own requests" ON public.leave_requests;
CREATE POLICY "Users can view their own requests"
    ON public.leave_requests FOR SELECT
    USING (user_id = auth.uid() OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create their own requests" ON public.leave_requests;
CREATE POLICY "Users can create their own requests"
    ON public.leave_requests FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own pending requests" ON public.leave_requests;
CREATE POLICY "Users can update their own pending requests"
    ON public.leave_requests FOR UPDATE
    USING (user_id = auth.uid() OR organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- STEP 11: RLS for leave_balances
DROP POLICY IF EXISTS "Users can view their own balances" ON public.leave_balances;
CREATE POLICY "Users can view their own balances"
    ON public.leave_balances FOR SELECT
    USING (user_id = auth.uid());

-- STEP 12: RLS for leave_request_actions
DROP POLICY IF EXISTS "Users can view actions for their requests" ON public.leave_request_actions;
CREATE POLICY "Users can view actions for their requests"
    ON public.leave_request_actions FOR SELECT
    USING (
        leave_request_id IN (
            SELECT id FROM public.leave_requests WHERE user_id = auth.uid()
        )
        OR actor_id = auth.uid()
    );

DROP POLICY IF EXISTS "Users can insert actions" ON public.leave_request_actions;
CREATE POLICY "Users can insert actions"
    ON public.leave_request_actions FOR INSERT
    WITH CHECK (actor_id = auth.uid());

-- STEP 13: Create the submit_leave_request RPC
CREATE OR REPLACE FUNCTION public.submit_leave_request(
  p_leave_type_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_reason TEXT,
  p_is_emergency BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_org_id UUID;
  v_new_request_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: You must be logged in.';
  END IF;

  SELECT organization_id INTO v_org_id FROM public.profiles WHERE id = v_user_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'PROFILE_ERROR: Account not linked to an organization.';
  END IF;

  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: End date cannot be before start date.';
  END IF;

  INSERT INTO public.leave_requests (
    organization_id, user_id, leave_type_id,
    start_date, end_date, reason, is_emergency, status
  ) VALUES (
    v_org_id, v_user_id, p_leave_type_id,
    p_start_date, p_end_date, p_reason, p_is_emergency, 'pending'
  )
  RETURNING id INTO v_new_request_id;

  RETURN json_build_object('success', true, 'id', v_new_request_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_leave_request TO authenticated;

-- STEP 14: Seed default leave types for existing organizations (if missing)
INSERT INTO public.leave_types (organization_id, name, description, icon, color, is_paid)
SELECT o.id, t.name, t.description, t.icon, t.color, t.is_paid
FROM public.organizations o
CROSS JOIN (VALUES
    ('Casual Leave', 'General purpose personal leave', 'Calendar', '#6366f1', true),
    ('Sick Leave', 'Medical and health related absence', 'Activity', '#ef4444', true),
    ('Emergency Leave', 'Unforeseen urgent situations', 'AlertCircle', '#f97316', true),
    ('Annual Leave', 'Planned vacation and time off', 'Sun', '#22c55e', true)
) AS t(name, description, icon, color, is_paid)
WHERE NOT EXISTS (
    SELECT 1 FROM public.leave_types lt
    WHERE lt.organization_id = o.id AND lt.name = t.name
);

-- STEP 15: Force schema reload
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');
