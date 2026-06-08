import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function addModule() {
  const { data, error } = await supabase.from('module_registry').upsert({
    key: 'attendance',
    name: 'Attendance',
    icon: 'Clock',
    route: '/attendance',
    category: 'top',
    sort_order: 50,
    permission: 'module.attendance',
    is_enabled: true
  }, { onConflict: 'key' });
  
  if (error) console.error("Error:", error);
  else console.log("Added module attendance.");
}
addModule();
