import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzM1NTcwNCwiZXhwIjoyMDkyOTMxNzA0fQ._wUbuBcKtzlELuDSN9VapUUtqi8fVy6oBruTbsY-XRo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data: dept, error: errDept } = await supabase.from('departments').select('*').limit(1);
  console.log("departments record keys:", dept?.[0] ? Object.keys(dept[0]) : "No departments");

  const { data: pm, error: errPm } = await supabase.from('project_members').select('*').limit(1);
  console.log("project_members record keys:", pm?.[0] ? Object.keys(pm[0]) : "No project_members");

  const { data: dm, error: errDm } = await supabase.from('department_members').select('*').limit(1);
  console.log("department_members record keys:", dm?.[0] ? Object.keys(dm[0]) : "No department_members");

  const { data: etm, error: errEtm } = await supabase.from('employee_team_mapping').select('*').limit(1);
  console.log("employee_team_mapping record keys:", etm?.[0] ? Object.keys(etm[0]) : "No employee_team_mapping");

  const { data: pmod, error: errPmod } = await supabase.from('project_modules').select('*').limit(1);
  console.log("project_modules record keys:", pmod?.[0] ? Object.keys(pmod[0]) : "No project_modules");
}

checkTables();
