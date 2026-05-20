-- ENTERPRISE TIME DESK SECURITY & CONFIGURATION ARCHITECTURE
-- SCOPE: Organization-Level Policy Governance

-- 1. ORGANIZATION WORK SETTINGS
CREATE TABLE IF NOT EXISTS public.organization_work_settings (
    organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Tracking Rules
    min_working_hours INTEGER DEFAULT 8,
    is_flexible_mode BOOLEAN DEFAULT false,
    track_productivity BOOLEAN DEFAULT true,
    
    -- Shift Timing
    default_shift_start TIME DEFAULT '09:00:00',
    default_shift_end TIME DEFAULT '18:00:00',
    late_threshold_minutes INTEGER DEFAULT 15,
    
    -- Break Policy (Specific windows for Tea/Lunch)
    break_schedule JSONB DEFAULT '[
        {"name": "Tea Break (Morning)", "start": "11:00", "end": "11:15", "type": "short"},
        {"name": "Lunch Break", "start": "13:00", "end": "14:00", "type": "long"},
        {"name": "Tea Break (Evening)", "start": "16:00", "end": "16:15", "type": "short"}
    ]'::jsonb,
    
    -- Working Days
    working_days JSONB DEFAULT '{"mon": true, "tue": true, "wed": true, "thu": true, "fri": true, "sat": false, "sun": false}'::jsonb,
    
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. LEAVE POLICIES
CREATE TABLE IF NOT EXISTS public.organization_leave_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    policy_name TEXT NOT NULL,
    yearly_limit INTEGER DEFAULT 24,
    monthly_cap INTEGER DEFAULT 2,
    carry_forward_limit INTEGER DEFAULT 5,
    is_paid BOOLEAN DEFAULT true,
    
    restrictions JSONB DEFAULT '{"min_service_days": 90, "advance_notice_days": 7}'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. SETTINGS AUDIT LOGS (Immutable)
CREATE TABLE IF NOT EXISTS public.settings_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    old_value JSONB,
    new_value JSONB,
    
    action_type TEXT NOT NULL, -- 'UPDATE', 'CREATE', 'DELETE'
    timestamp TIMESTAMPTZ DEFAULT now()
);

-- 4. ROW LEVEL SECURITY (STRICT RBAC)
ALTER TABLE public.organization_work_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_leave_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Only Admins/SuperAdmins can view or modify org-level settings
DROP POLICY IF EXISTS "Admins can manage work settings" ON public.organization_work_settings;
CREATE POLICY "Admins can manage work settings"
    ON public.organization_work_settings
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND role IN ('admin', 'super_admin')
            AND organization_id = public.organization_work_settings.organization_id
        )
    );

DROP POLICY IF EXISTS "Employees can view their org work settings" ON public.organization_work_settings;
CREATE POLICY "Employees can view their org work settings"
    ON public.organization_work_settings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() 
            AND organization_id = public.organization_work_settings.organization_id
        )
    );

-- Audit Log Policy: Only SuperAdmins can view full audit trail
DROP POLICY IF EXISTS "SuperAdmins view audit logs" ON public.settings_audit_logs;
CREATE POLICY "SuperAdmins view audit logs"
    ON public.settings_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

-- 5. AUDIT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.log_settings_change()
RETURNS TRIGGER AS $$
DECLARE
    v_record_id UUID;
BEGIN
    -- Dynamically handle primary key (id vs organization_id)
    BEGIN
        v_record_id := COALESCE(NEW.id, OLD.id);
    EXCEPTION WHEN undefined_column THEN
        v_record_id := COALESCE(NEW.organization_id, OLD.organization_id);
    END;

    INSERT INTO public.settings_audit_logs (
        organization_id,
        changed_by,
        table_name,
        record_id,
        old_value,
        new_value,
        action_type
    ) VALUES (
        COALESCE(NEW.organization_id, OLD.organization_id),
        auth.uid(),
        TG_TABLE_NAME,
        v_record_id,
        to_jsonb(OLD),
        to_jsonb(NEW),
        TG_OP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply triggers
DROP TRIGGER IF EXISTS tr_audit_work_settings ON public.organization_work_settings;
CREATE TRIGGER tr_audit_work_settings
AFTER UPDATE ON public.organization_work_settings
FOR EACH ROW EXECUTE FUNCTION public.log_settings_change();

DROP TRIGGER IF EXISTS tr_audit_leave_policy ON public.organization_leave_policies;
CREATE TRIGGER tr_audit_leave_policy
AFTER INSERT OR UPDATE OR DELETE ON public.organization_leave_policies
FOR EACH ROW EXECUTE FUNCTION public.log_settings_change();
