import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
  const { data, error } = await supabase.from('pg_trigger').select('tgname, tgrelid, tgfoid').limit(50);
  console.log("pg_trigger data:", data?.length ? "Found items" : "No items or access denied");
  if (error) console.error("Error:", error);
}

checkTriggers();
