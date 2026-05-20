import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT event_object_table AS table_name, trigger_name, action_statement
      FROM information_schema.triggers
      WHERE event_object_schema = 'public'
      AND event_object_table IN ('profiles', 'user_roles', 'role_permissions');
    `
  });

  if (error) {
    console.error("Error fetching triggers:", error);
  } else {
    console.log("Triggers found:\n", JSON.stringify(data, null, 2));
  }
}

checkTriggers();
