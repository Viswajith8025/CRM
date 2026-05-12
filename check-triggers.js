import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: "SELECT trigger_name, event_object_table, action_statement FROM information_schema.triggers WHERE event_object_table = 'tasks';"
  });
  
  if (error) {
    console.error("RPC failed, trying fallback to pg_class...");
    // Fallback: we can't easily query triggers without RPC if it's not exposed
  } else {
    console.log("Triggers:", data);
  }
}

checkTriggers();
