const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { error: e1 } = await supabase.from('projects').select('*').in('status', ['active']).limit(1);
  const { error: e2 } = await supabase.from('tasks').select('*').not('status', 'in', '("completed")').limit(1);
  const { error: e3 } = await supabase.from('project_milestones').select('*').neq('status', 'completed').limit(1);
  console.log('Errors:', {e1: e1?.message, e2: e2?.message, e3: e3?.message});
}
test();
