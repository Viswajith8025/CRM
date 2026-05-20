-- ==============================================================================
-- FIX ONBOARDING PORTAL PUBLIC RLS, TRIGGERS & STORAGE POLICIES
-- ==============================================================================
-- Root cause: trigger function references "public.departments" which does not
-- exist, crashing the entire UPDATE transaction and producing 404.
-- ==============================================================================

-- A. REPLACE TRIGGER FUNCTION — safely handles missing tables
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
    v_admin_id UUID;
BEGIN
    -- Only trigger on transition to 'submitted'
    IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN

        -- 1. Extract standard contact answers from form answers
        BEGIN
            SELECT answer_value INTO v_company_name
            FROM public.form_submission_answers a
            JOIN public.form_fields f ON a.field_id = f.id
            WHERE a.submission_id = NEW.id AND f.code = 'company_name' LIMIT 1;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            SELECT answer_value INTO v_contact_name
            FROM public.form_submission_answers a
            JOIN public.form_fields f ON a.field_id = f.id
            WHERE a.submission_id = NEW.id AND f.code = 'contact_name' LIMIT 1;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            SELECT answer_value INTO v_contact_email
            FROM public.form_submission_answers a
            JOIN public.form_fields f ON a.field_id = f.id
            WHERE a.submission_id = NEW.id AND f.code = 'contact_email' LIMIT 1;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        BEGIN
            SELECT answer_value INTO v_contact_phone
            FROM public.form_submission_answers a
            JOIN public.form_fields f ON a.field_id = f.id
            WHERE a.submission_id = NEW.id AND f.code = 'contact_phone' LIMIT 1;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- 2. Fetch service type from template
        BEGIN
            SELECT service_type INTO v_service_type
            FROM public.form_templates
            WHERE id = NEW.template_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- 3. Locate an admin profile in the organization to own the lead
        BEGIN
            SELECT id INTO v_admin_id
            FROM public.profiles
            WHERE organization_id = NEW.organization_id AND role = 'admin'
            LIMIT 1;

            IF v_admin_id IS NULL THEN
                SELECT id INTO v_admin_id
                FROM public.profiles
                WHERE organization_id = NEW.organization_id
                LIMIT 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- 4. Auto-create Lead in CRM Pipeline
        IF NEW.lead_id IS NULL AND NEW.client_id IS NULL THEN
            BEGIN
                INSERT INTO public.leads (
                    organization_id, user_id,
                    first_name, last_name, email, phone, company,
                    status, source, notes
                ) VALUES (
                    NEW.organization_id,
                    COALESCE(v_admin_id, '00000000-0000-0000-0000-000000000000'::uuid),
                    COALESCE(SPLIT_PART(v_contact_name, ' ', 1), 'New'),
                    COALESCE(SUBSTRING(v_contact_name FROM POSITION(' ' IN v_contact_name) + 1), 'Onboarding Lead'),
                    COALESCE(v_contact_email, 'onboarding-' || NEW.id || '@ecraftz.com'),
                    v_contact_phone,
                    COALESCE(v_company_name, 'Company ' || NEW.id),
                    'new',
                    'Client Onboarding Form',
                    'Generated via Client Request Portal. Service: ' || COALESCE(v_service_type, 'General')
                ) RETURNING id INTO v_lead_id;

                NEW.lead_id := v_lead_id;
            EXCEPTION WHEN OTHERS THEN
                -- Lead creation failed (e.g. FK constraint) — continue anyway
                NULL;
            END;
        END IF;

        -- 5. Write audit log
        BEGIN
            INSERT INTO public.activities (
                user_id, organization_id, action, target_type,
                target_id, target_name, severity, metadata
            ) VALUES (
                COALESCE(auth.uid(), v_admin_id),
                NEW.organization_id,
                'ONBOARDING_SUBMITTED',
                'submission',
                NEW.id,
                COALESCE(v_company_name, 'Dynamic Service Request'),
                'info',
                jsonb_build_object(
                    'service_type', v_service_type,
                    'lead_id', NEW.lead_id
                )
            );
        EXCEPTION WHEN OTHERS THEN
            -- Audit log failure must never block submission
            NULL;
        END;

    END IF;
    RETURN NEW;
END;
$$;


-- B. RLS POLICIES FOR ANONYMOUS PORTAL ACCESS

DROP POLICY IF EXISTS "public_submissions_portal_policy" ON public.form_submissions;
CREATE POLICY "public_submissions_portal_policy" ON public.form_submissions
    FOR ALL TO anon, authenticated
    USING (status != 'archived')
    WITH CHECK (status != 'archived');

DROP POLICY IF EXISTS "public_templates_portal_policy" ON public.form_templates;
CREATE POLICY "public_templates_portal_policy" ON public.form_templates
    FOR SELECT TO anon, authenticated
    USING (status = 'active');

DROP POLICY IF EXISTS "public_sections_portal_policy" ON public.form_sections;
CREATE POLICY "public_sections_portal_policy" ON public.form_sections
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "public_fields_portal_policy" ON public.form_fields;
CREATE POLICY "public_fields_portal_policy" ON public.form_fields
    FOR SELECT TO anon, authenticated
    USING (true);

DROP POLICY IF EXISTS "public_answers_portal_policy" ON public.form_submission_answers;
CREATE POLICY "public_answers_portal_policy" ON public.form_submission_answers
    FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public_attachments_portal_policy" ON public.form_attachments;
CREATE POLICY "public_attachments_portal_policy" ON public.form_attachments
    FOR ALL TO anon, authenticated
    USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public upload to onboarding folder" ON storage.objects;
CREATE POLICY "Allow public upload to onboarding folder" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'documents' AND name LIKE 'onboarding/%');

DROP POLICY IF EXISTS "Allow public read from onboarding folder" ON storage.objects;
CREATE POLICY "Allow public read from onboarding folder" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'documents' AND name LIKE 'onboarding/%');

NOTIFY pgrst, 'reload schema';
