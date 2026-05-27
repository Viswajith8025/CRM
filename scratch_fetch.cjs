const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({path: '.env'});
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function test() {
  const { data } = await supabase.from('employee_performance_logs').select('*');
  console.log('Logs:', data);
}
test();
