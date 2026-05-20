-- Migration: Add department_id to projects table and department to profiles table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;
NOTIFY pgrst, 'reload schema';
