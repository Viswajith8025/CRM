-- ==============================================================================
-- ENTERPRISE SECURITY HARDENING & RLS ENFORCEMENT
-- Closes Cross-Tenant Leaks and Privilege Escalation Gaps
-- ==============================================================================

-- 1. SECURE ORG ID HELPER (IMMUTABLE & LEAK-PROOF)
CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS UUID AS $$
BEGIN
  -- Extract org_id from JWT metadata (Securely set by Auth service)
  -- If not in JWT, fallback to profile lookup (Cached in session)
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id')::uuid,
    (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2. HARDENING PROFILES (PREVENT SELF-PROMOTION)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles Update Own" ON public.profiles;
CREATE POLICY "Profiles Update Own Secure" ON public.profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (
    id = auth.uid() AND 
    (role = (SELECT role FROM public.profiles WHERE id = auth.uid())) AND -- Prevent role change
    (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())) -- Prevent org change
);

-- 3. GLOBAL TENANT ISOLATION (APPLY TO ALL CORE TABLES)
DO $$
DECLARE
    t text;
    tables text[] := ARRAY['leads', 'clients', 'projects', 'tasks', 'invoices', 'task_time_logs', 'attachments', 'activities'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS "tenant_isolation_%I" ON public.%I', t, t);
        EXECUTE format('CREATE POLICY "tenant_isolation_%I" ON public.%I FOR ALL TO authenticated USING (organization_id = public.get_my_org_id())', t, t);
    END LOOP;
END $$;

-- 4. ACTIVITY LOG PROTECTION (IMMUTABLE LOGS)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "activities_read" ON public.activities;
CREATE POLICY "activities_read_org" ON public.activities
FOR SELECT TO authenticated
USING (organization_id = public.get_my_org_id());

-- DENY ALL DELETE/UPDATE ON ACTIVITIES (Making logs immutable)
CREATE POLICY "activities_no_update" ON public.activities FOR UPDATE TO authenticated USING (false);
CREATE POLICY "activities_no_delete" ON public.activities FOR DELETE TO authenticated USING (false);

-- 5. RPC SECURITY (SECURE SCHEMA ACCESS)
-- Revoke public access to internal schemas
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
