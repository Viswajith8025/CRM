-- Insert missing KPI definitions for Sales and BDE operations
INSERT INTO public.kpi_registry (code, name, description, data_type, aggregation_type, category)
VALUES 
  ('meetings_arranged', 'Meetings Arranged', 'Total meetings set up', 'number', 'sum', 'sales'),
  ('emails_sent', 'Emails/Messages Sent', 'Total digital outreach', 'number', 'sum', 'sales')
ON CONFLICT (code) DO NOTHING;
