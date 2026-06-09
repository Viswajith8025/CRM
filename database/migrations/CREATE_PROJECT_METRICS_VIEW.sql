-- Create a view for aggregated project metrics to eliminate client-side aggregation
CREATE OR REPLACE VIEW project_health_metrics AS
SELECT 
  p.id AS project_id,
  COUNT(t.id) AS total_tasks,
  SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS completed_tasks,
  SUM(CASE WHEN t.due_date < CURRENT_DATE AND t.status != 'done' THEN 1 ELSE 0 END) AS overdue_tasks,
  (SELECT COUNT(*) FROM project_milestones pm WHERE pm.project_id = p.id AND pm.due_date < CURRENT_DATE AND pm.is_completed = false) AS missed_milestones,
  COALESCE((SELECT SUM(grand_total) FROM invoices i WHERE i.project_id = p.id AND i.status = 'paid' AND i.deleted_at IS NULL), 0) AS revenue,
  COALESCE((SELECT SUM(amount) FROM project_expenses e WHERE e.project_id = p.id), 0) AS expense_total,
  0 AS labor_cost, -- Can be derived from time desk later
  COALESCE((SELECT SUM(grand_total) FROM invoices i WHERE i.project_id = p.id AND i.status = 'paid' AND i.deleted_at IS NULL), 0) - COALESCE((SELECT SUM(amount) FROM project_expenses e WHERE e.project_id = p.id), 0) AS profit,
  0 AS budget_burn -- Can be derived based on budgeted amount later
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL
GROUP BY p.id;

NOTIFY pgrst, 'reload schema';
