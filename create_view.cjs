require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

const sql = `CREATE OR REPLACE VIEW public.v_project_health_stats AS SELECT p.id AS project_id, COUNT(t.id) AS total_tasks, COUNT(t.id) FILTER (WHERE t.status = 'done' OR t.status = 'completed') AS completed_tasks, COUNT(t.id) FILTER (WHERE t.status != 'done' AND t.status != 'completed' AND t.due_date < CURRENT_DATE) AS overdue_tasks, 0 AS missed_milestones, 0 AS revenue, 0 AS labor_cost, 0 AS expense_total, 0 AS profit, 0 AS budget_burn FROM projects p LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL GROUP BY p.id;`;

supabase.rpc('exec_sql', { sql_string: sql }).then(res => console.log('View Created:', res));
