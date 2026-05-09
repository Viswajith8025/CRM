-- ==============================================================================
-- SANDBOX / DEMO SEEDER ENGINE
-- Generates high-fidelity fake data for sales demos
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_data(org_id UUID)
RETURNS void AS $$
DECLARE
  client_id_1 UUID;
  client_id_2 UUID;
  project_id_1 UUID;
BEGIN
  -- 1. Create Demo Clients
  INSERT INTO clients (name, email, phone, organization_id, contract_value, status)
  VALUES 
    ('Acme Corp', 'contact@acme.com', '+1-555-0101', org_id, 25000, 'active'),
    ('Globex Corporation', 'ceo@globex.com', '+1-555-0202', org_id, 45000, 'active')
  RETURNING id INTO client_id_1;

  INSERT INTO clients (name, email, phone, organization_id, contract_value, status)
  VALUES ('Cyberdyne Systems', 'miles@cyberdyne.io', '+1-555-0303', org_id, 120000, 'active')
  RETURNING id INTO client_id_2;

  -- 2. Create Demo Projects
  INSERT INTO projects (name, client_id, organization_id, status, budget, start_date, end_date)
  VALUES 
    ('Cloud Migration Alpha', client_id_1, org_id, 'in_progress', 15000, NOW() - INTERVAL '30 days', NOW() + INTERVAL '60 days')
  RETURNING id INTO project_id_1;

  INSERT INTO projects (name, client_id, organization_id, status, budget, start_date)
  VALUES ('AI Onboarding Phase 1', client_id_2, org_id, 'planning', 55000, NOW());

  -- 3. Create Demo Tasks
  INSERT INTO tasks (title, project_id, organization_id, status, priority, due_date)
  VALUES 
    ('Initial Server Audit', project_id_1, org_id, 'done', 'high', NOW() - INTERVAL '20 days'),
    ('Database Schema Mapping', project_id_1, org_id, 'todo', 'medium', NOW() + INTERVAL '5 days'),
    ('Security Hardening', project_id_1, org_id, 'todo', 'high', NOW() + INTERVAL '10 days');

  -- 4. Create Demo Invoices
  INSERT INTO invoices (invoice_number, client_id, organization_id, amount, status, due_date, issued_at)
  VALUES 
    ('INV-DEMO-001', client_id_1, org_id, 5000, 'paid', NOW() - INTERVAL '5 days', NOW() - INTERVAL '15 days'),
    ('INV-DEMO-002', client_id_1, org_id, 10000, 'sent', NOW() + INTERVAL '15 days', NOW());

  -- 5. Create Demo Leads
  INSERT INTO leads (first_name, last_name, email, company, status, value, organization_id)
  VALUES 
    ('Tony', 'Stark', 'tony@stark.com', 'Stark Industries', 'qualified', 1000000, org_id),
    ('Bruce', 'Wayne', 'bruce@wayne.com', 'Wayne Enterprises', 'proposal_sent', 250000, org_id);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
