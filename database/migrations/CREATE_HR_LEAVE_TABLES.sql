-- ==============================================================================
-- CREATE HR LEAVE MANAGEMENT TABLES (WITH MULTI-TENANCY)
-- ==============================================================================

-- 1. LEAVE TYPES
CREATE TABLE IF NOT EXISTS public.leave_types (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3b82f6',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'clarification_required')),
    is_emergency BOOLEAN DEFAULT false,
    current_approver_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. LEAVE REQUEST ACTIONS (Audit Trail)
CREATE TABLE IF NOT EXISTS public.leave_request_actions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('approve', 'reject', 'clarification', 'cancel', 'submit')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. LEAVE BALANCES
CREATE TABLE IF NOT EXISTS public.leave_balances (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id) ON DELETE CASCADE,
    total_allowance NUMERIC(5, 2) NOT NULL DEFAULT 0,
    used NUMERIC(5, 2) NOT NULL DEFAULT 0,
    year INT NOT NULL DEFAULT extract(year from current_date),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, leave_type_id, year)
);

-- Insert Default Leave Types
INSERT INTO public.leave_types (organization_id, name, color)
VALUES 
    ('00000000-0000-0000-0000-000000000000', 'Paid Leave', '#10b981'),
    ('00000000-0000-0000-0000-000000000000', 'Sick Leave', '#f43f5e'),
    ('00000000-0000-0000-0000-000000000000', 'Casual Leave', '#3b82f6'),
    ('00000000-0000-0000-0000-000000000000', 'Unpaid Leave', '#64748b')
ON CONFLICT DO NOTHING;

-- ENABLE RLS
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_request_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- POLICIES (MULTI-TENANCY SECURE)

-- Leave Types
DROP POLICY IF EXISTS "leave_types_select" ON public.leave_types;
CREATE POLICY "leave_types_select" ON public.leave_types FOR SELECT TO authenticated USING (true);

-- Leave Requests
DROP POLICY IF EXISTS "leave_requests_select" ON public.leave_requests;
CREATE POLICY "leave_requests_select" ON public.leave_requests FOR SELECT TO authenticated USING (organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "leave_requests_insert" ON public.leave_requests;
CREATE POLICY "leave_requests_insert" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND organization_id = public.get_my_org_id());

DROP POLICY IF EXISTS "leave_requests_update" ON public.leave_requests;
CREATE POLICY "leave_requests_update" ON public.leave_requests FOR UPDATE TO authenticated USING (organization_id = public.get_my_org_id());

-- Leave Request Actions
DROP POLICY IF EXISTS "leave_request_actions_select" ON public.leave_request_actions;
CREATE POLICY "leave_request_actions_select" ON public.leave_request_actions FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.leave_requests lr WHERE lr.id = leave_request_id AND lr.organization_id = public.get_my_org_id())
);

DROP POLICY IF EXISTS "leave_request_actions_insert" ON public.leave_request_actions;
CREATE POLICY "leave_request_actions_insert" ON public.leave_request_actions FOR INSERT TO authenticated WITH CHECK (actor_id = auth.uid());

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
