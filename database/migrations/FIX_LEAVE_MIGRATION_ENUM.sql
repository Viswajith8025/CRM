-- FIX FOR ENUM ERROR & UPGRADE TO DYNAMIC RBAC
-- This script adds the 'hr' role to the system and updates Leave Management to use the Dynamic Permission Engine.

-- 1. EXTEND USER ROLE ENUM (Safe Addition)
DO $$ 
BEGIN 
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'hr'; 
EXCEPTION 
  WHEN duplicate_object THEN null; 
END $$;

-- 2. RE-RUN LEAVE MANAGEMENT MIGRATION WITH DYNAMIC PERMISSIONS
-- (Ensures no hardcoded role checks that cause enum errors)

-- 1. ENUMS (Leave Status)
DO $$ BEGIN
    CREATE TYPE leave_request_status AS ENUM (
        'pending', 
        'approved', 
        'rejected', 
        'cancelled', 
        'clarification_required'
    );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. LEAVE TYPES
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

-- 3. LEAVE POLICIES
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

-- 4. LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    leave_type_id UUID NOT NULL REFERENCES public.leave_types(id),
    
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_half_day BOOLEAN DEFAULT false,
    half_day_period TEXT, -- 'morning', 'afternoon'
    
    reason TEXT NOT NULL,
    is_emergency BOOLEAN DEFAULT false,
    attachment_url TEXT,
    
    status leave_request_status DEFAULT 'pending',
    current_approver_id UUID REFERENCES auth.users(id),
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

-- 5. LEAVE REQUEST ACTIONS
CREATE TABLE IF NOT EXISTS public.leave_request_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    leave_request_id UUID NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES auth.users(id),
    
    action TEXT NOT NULL,
    note TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. LEAVE BALANCES
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

-- 7. DYNAMIC RLS POLICIES (Using has_permission instead of hardcoded roles)

ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_request_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

-- Leave Types RLS
DROP POLICY IF EXISTS "Users can view active leave types in their org" ON public.leave_types;
CREATE POLICY "Users can view active leave types in their org"
    ON public.leave_types FOR SELECT
    USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- Leave Requests RLS
DROP POLICY IF EXISTS "Users can view their own requests" ON public.leave_requests;
CREATE POLICY "Users can view their own requests"
    ON public.leave_requests FOR SELECT
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own requests" ON public.leave_requests;
CREATE POLICY "Users can create their own requests"
    ON public.leave_requests FOR INSERT
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view and update all requests in org" ON public.leave_requests;
CREATE POLICY "Admins can view and update all requests in org"
    ON public.leave_requests FOR ALL
    USING (
        public.has_permission('leave.approval.view')
        OR user_id = auth.uid()
    );

-- Leave Balances RLS
DROP POLICY IF EXISTS "Users can view their own balances" ON public.leave_balances;
CREATE POLICY "Users can view their own balances"
    ON public.leave_balances FOR SELECT
    USING (user_id = auth.uid());

-- 8. MODULE REGISTRY (Dynamic RBAC)
INSERT INTO public.module_registry (key, name, icon, route, category, sort_order, permission)
VALUES 
  ('leave_requests', 'Leave Requests', 'Calendar', '/leave-requests', 'top', 14, 'leave.request.view_own'),
  ('leave_approvals', 'Leave Approvals', 'CheckSquare', '/leave-approvals', 'top', 15, 'leave.approval.view')
ON CONFLICT (key) DO UPDATE SET
  permission = EXCLUDED.permission;

-- 9. PERMISSIONS SEEDING
INSERT INTO public.permissions (code, module, name, description, type)
VALUES 
  ('leave.request.create', 'HR', 'Create Leave Request', 'Allows employee to submit leave requests', 'action'),
  ('leave.request.view_own', 'HR', 'View Own Leaves', 'Allows employee to see their leave history', 'action'),
  ('leave.approval.view', 'HR', 'View Leave Approvals', 'Allows HR/Admin to see pending approvals', 'module'),
  ('leave.approval.manage', 'HR', 'Manage Approvals', 'Allows HR/Admin to approve or reject leaves', 'action'),
  ('leave.policy.manage', 'HR', 'Manage Policies', 'Allows HR/Admin to configure leave types and rules', 'action')
ON CONFLICT (code) DO UPDATE SET
    module = EXCLUDED.module,
    type = EXCLUDED.type;

-- 10. AUTO-GRANT TO SUPER ADMINS
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'Super Admin' AND p.code LIKE 'leave.%'
ON CONFLICT DO NOTHING;

-- 11. REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
