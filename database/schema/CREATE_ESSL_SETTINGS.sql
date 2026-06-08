-- Run this in your Supabase SQL Editor to create the table for eSSL device settings
CREATE TABLE IF NOT EXISTS public.essl_device_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organization_settings(id) ON DELETE CASCADE,
    url TEXT NOT NULL DEFAULT 'http://192.168.1.34:85/iclock/WebAPIService.asmx',
    serial_number TEXT,
    user_name TEXT,
    user_password TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(organization_id)
);

ALTER TABLE public.essl_device_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select essl config" ON public.essl_device_settings 
    FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr', 'employee') AND organization_id = essl_device_settings.organization_id));

CREATE POLICY "Admin insert essl config" ON public.essl_device_settings 
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr') AND organization_id = essl_device_settings.organization_id));

CREATE POLICY "Admin update essl config" ON public.essl_device_settings 
    FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'hr') AND organization_id = essl_device_settings.organization_id));
