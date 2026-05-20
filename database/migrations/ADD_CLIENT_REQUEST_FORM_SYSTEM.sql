-- ==============================================================================
-- ADD CLIENT REQUEST FORM & PREMIUM ONBOARDING SYSTEM
-- ==============================================================================
-- Sets up fully dynamic templates, fields, sections, submissions, conditional logic,
-- secure asset storage, masked credentials encryption, and multi-tenant RLS.
-- ==============================================================================

-- 1. EXTEND SYSTEM PERMISSIONS CATALOG WITH FORM MODULE PERMISSIONS
INSERT INTO public.permissions (code, module, name, description, type) VALUES
  ('module.forms', 'Forms', 'Client Onboarding Module', 'Access to dynamic client request and onboarding forms dashboard.', 'module'),
  ('forms.manage', 'Forms', 'Manage Onboarding Forms', 'Ability to archive, delete, or configure global onboarding workflows.', 'action'),
  ('forms.create', 'Forms', 'Create Form Templates', 'Ability to create new service onboarding templates.', 'action'),
  ('forms.edit',   'Forms', 'Edit Form Fields & Logic', 'Ability to design sections, modify fields, and add conditional logic.', 'action'),
  ('forms.view',   'Forms', 'View Submissions', 'Access to view and audit dynamic client responses.', 'action'),
  ('forms.submit', 'Forms', 'Submit Onboarding Requests', 'Ability to fill out client-facing request forms.', 'action'),
  ('forms.assign', 'Forms', 'Assign Form Submissions', 'Delegate incoming onboarding files to operational departments.', 'action')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 2. REGISTER MODULE IN THE DYNAMIC SIDEBAR
INSERT INTO public.module_registry (key, name, icon, route, category, sort_order, permission)
VALUES
  ('forms', 'Client Onboarding', 'FileText', '/crm/onboarding', 'top', 3, 'module.forms')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  route = EXCLUDED.route,
  permission = EXCLUDED.permission;

-- 3. CORE DATABASE SCHEMA

-- A. Form Templates Table
CREATE TABLE IF NOT EXISTS public.form_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    service_type TEXT NOT NULL, -- e.g. 'Web Development', 'Digital Marketing'
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- B. Form Sections Table
CREATE TABLE IF NOT EXISTS public.form_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- C. Form Fields Table
CREATE TABLE IF NOT EXISTS public.form_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES public.form_sections(id) ON DELETE CASCADE,
    code TEXT NOT NULL, -- unique reference code (e.g. 'company_name', 'ig_password')
    label TEXT NOT NULL,
    placeholder TEXT,
    field_type TEXT NOT NULL CHECK (field_type IN (
        'text', 'textarea', 'dropdown', 'radio', 'multiselect', 'datepicker', 
        'file', 'image', 'url', 'password', 'dynamic_repeater', 'conditional_section'
    )),
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_sensitive BOOLEAN NOT NULL DEFAULT false, -- masks field in UI, triggers secure handling
    sort_order INT NOT NULL DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}'::jsonb, -- dynamic attributes (options, validation, regex)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D. Form Submissions Table
CREATE TABLE IF NOT EXISTS public.form_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
        'draft', 'submitted', 'under_review', 'clarification_needed', 'approved'
    )),
    completion_rate NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    current_step INT NOT NULL DEFAULT 0,
    assigned_department_id UUID, -- department assigned to process onboarding
    assigned_user_id UUID,
    clarification_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- E. Form Submission Answers Table
CREATE TABLE IF NOT EXISTS public.form_submission_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES public.form_fields(id) ON DELETE CASCADE,
    answer_value TEXT, -- plain text values or json-serialized choices/repeater rows
    answer_encrypted TEXT, -- for sensitive credential tokens (passwords/API keys)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- F. Conditional Logic Table
CREATE TABLE IF NOT EXISTS public.form_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_id UUID NOT NULL REFERENCES public.form_fields(id) ON DELETE CASCADE, -- the target field being affected
    trigger_field_id UUID NOT NULL REFERENCES public.form_fields(id) ON DELETE CASCADE, -- the controller field
    operator TEXT NOT NULL CHECK (operator IN ('equals', 'not_equals', 'contains', 'is_empty', 'is_not_empty')),
    value TEXT, -- value to compare against
    action TEXT NOT NULL CHECK (action IN ('show', 'hide', 'require', 'disable')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- G. Form Attachments Table
CREATE TABLE IF NOT EXISTS public.form_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
    field_id UUID NOT NULL REFERENCES public.form_fields(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INT NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ENABLE RLS (ROW LEVEL SECURITY) & ENFORCE MULTI-TENANCY
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "templates_org_isolation" ON public.form_templates;
CREATE POLICY "templates_org_isolation" ON public.form_templates
    FOR ALL USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "submissions_org_isolation" ON public.form_submissions;
CREATE POLICY "submissions_org_isolation" ON public.form_submissions
    FOR ALL USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 5. SECURE AUTOMATION: AUTOMATIC CRM INTEGRATION
-- Triggers whenever a submission status transitions to 'submitted'
CREATE OR REPLACE FUNCTION public.integrate_submission_to_crm()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_company_name TEXT;
    v_contact_name TEXT;
    v_contact_email TEXT;
    v_contact_phone TEXT;
    v_service_type TEXT;
    v_lead_id UUID;
    v_dept_id UUID;
    v_answer_record RECORD;
BEGIN
    -- Only trigger on transition to 'submitted'
    IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
        -- 1. Extract standard contact answers from form answers
        SELECT answer_value INTO v_company_name 
        FROM public.form_submission_answers a
        JOIN public.form_fields f ON a.field_id = f.id
        WHERE a.submission_id = NEW.id AND f.code = 'company_name' LIMIT 1;

        SELECT answer_value INTO v_contact_name 
        FROM public.form_submission_answers a
        JOIN public.form_fields f ON a.field_id = f.id
        WHERE a.submission_id = NEW.id AND f.code = 'contact_name' LIMIT 1;

        SELECT answer_value INTO v_contact_email 
        FROM public.form_submission_answers a
        JOIN public.form_fields f ON a.field_id = f.id
        WHERE a.submission_id = NEW.id AND f.code = 'contact_email' LIMIT 1;

        SELECT answer_value INTO v_contact_phone 
        FROM public.form_submission_answers a
        JOIN public.form_fields f ON a.field_id = f.id
        WHERE a.submission_id = NEW.id AND f.code = 'contact_phone' LIMIT 1;

        -- 2. Fetch service type from template
        SELECT service_type INTO v_service_type 
        FROM public.form_templates 
        WHERE id = NEW.template_id;

        -- 3. Resolve department for routing based on service type
        SELECT id INTO v_dept_id 
        FROM public.departments 
        WHERE LOWER(name) LIKE LOWER(CONCAT('%', v_service_type, '%')) 
           OR LOWER(name) LIKE LOWER(CONCAT('%', SPLIT_PART(v_service_type, ' ', 1), '%'))
        LIMIT 1;

        -- Fallback to general sales/operations department if not found
        IF v_dept_id IS NULL THEN
            SELECT id INTO v_dept_id FROM public.departments WHERE is_system = true OR LOWER(name) IN ('sales', 'operations') LIMIT 1;
        END IF;

        -- 4. Add Lead in CRM Pipeline (if lead/client doesn't exist)
        IF NEW.lead_id IS NULL AND NEW.client_id IS NULL THEN
            INSERT INTO public.leads (
                organization_id,
                first_name,
                last_name,
                email,
                phone,
                company,
                status,
                source,
                notes
            ) VALUES (
                NEW.organization_id,
                COALESCE(SPLIT_PART(v_contact_name, ' ', 1), 'New'),
                COALESCE(SUBSTRING(v_contact_name FROM POSITION(' ' IN v_contact_name) + 1), 'Onboarding Lead'),
                COALESCE(v_contact_email, 'onboarding-' || NEW.id || '@ecraftz.com'),
                v_contact_phone,
                COALESCE(v_company_name, 'Company ' || NEW.id),
                'new',
                'Client Onboarding Form',
                'Generated dynamically via Client Request Portal. Service Type: ' || v_service_type
            ) RETURNING id INTO v_lead_id;

            -- Associate submission with created lead
            NEW.lead_id := v_lead_id;
        END IF;

        -- Set operational fields
        NEW.assigned_department_id := v_dept_id;

        -- 5. Trigger Realtime Notification Audit Log
        INSERT INTO public.activities (
            user_id,
            organization_id,
            action,
            target_type,
            target_id,
            target_name,
            severity,
            metadata
        ) VALUES (
            auth.uid(),
            NEW.organization_id,
            'ONBOARDING_SUBMITTED',
            'submission',
            NEW.id,
            COALESCE(v_company_name, 'Dynamic Service Request'),
            'info',
            jsonb_build_object(
                'service_type', v_service_type,
                'lead_id', NEW.lead_id,
                'department_id', v_dept_id
            )
        );

    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_submission_crm ON public.form_submissions;
CREATE OR REPLACE TRIGGER trg_onboarding_submission_crm
    BEFORE INSERT OR UPDATE ON public.form_submissions
    FOR EACH ROW EXECUTE FUNCTION public.integrate_submission_to_crm();

-- 6. DYNAMIC CHILD TABLES RLS GATEWAY Isolation Policies

-- A. Form Sections Isolation
ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sections_org_isolation" ON public.form_sections;
CREATE POLICY "sections_org_isolation" ON public.form_sections
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.form_templates t
            WHERE t.id = template_id 
              AND t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.form_templates t
            WHERE t.id = template_id 
              AND t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- B. Form Fields Isolation
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fields_org_isolation" ON public.form_fields;
CREATE POLICY "fields_org_isolation" ON public.form_fields
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.form_sections s
            JOIN public.form_templates t ON s.template_id = t.id
            WHERE s.id = section_id 
              AND t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.form_sections s
            JOIN public.form_templates t ON s.template_id = t.id
            WHERE s.id = section_id 
              AND t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- C. Form Submission Answers Isolation
ALTER TABLE public.form_submission_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "answers_org_isolation" ON public.form_submission_answers;
CREATE POLICY "answers_org_isolation" ON public.form_submission_answers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.form_submissions s
            WHERE s.id = submission_id 
              AND s.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.form_submissions s
            WHERE s.id = submission_id 
              AND s.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- D. Form Conditions Isolation
ALTER TABLE public.form_conditions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "conditions_org_isolation" ON public.form_conditions;
CREATE POLICY "conditions_org_isolation" ON public.form_conditions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.form_fields f
            JOIN public.form_sections s ON f.section_id = s.id
            JOIN public.form_templates t ON s.template_id = t.id
            WHERE f.id = field_id 
              AND t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.form_fields f
            JOIN public.form_sections s ON f.section_id = s.id
            JOIN public.form_templates t ON s.template_id = t.id
            WHERE f.id = field_id 
              AND t.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- E. Form Attachments Isolation
ALTER TABLE public.form_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attachments_org_isolation" ON public.form_attachments;
CREATE POLICY "attachments_org_isolation" ON public.form_attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.form_submissions s
            WHERE s.id = submission_id 
              AND s.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.form_submissions s
            WHERE s.id = submission_id 
              AND s.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- 7. AUTOMATICALLY ASSIGN NEW PERMISSIONS TO ADMINISTRATOR & SUPER ADMIN ROLES
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id, code FROM public.permissions WHERE code LIKE 'forms.%' OR code = 'module.forms' LOOP
        -- Grant to all Super Admin roles
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT id, r.id FROM public.roles WHERE name = 'Super Admin'
        ON CONFLICT DO NOTHING;

        -- Grant to all Administrator roles
        INSERT INTO public.role_permissions (role_id, permission_id)
        SELECT id, r.id FROM public.roles WHERE name = 'Administrator'
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
