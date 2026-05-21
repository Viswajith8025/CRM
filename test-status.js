import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('tasks').select('status').limit(100);
  if (data) {
    const statuses = [...new Set(data.map(d => d.status))];
    console.log("Distinct statuses found in tasks table:", statuses);
  } else {
    console.log("Error:", error);
  }
}
test();
