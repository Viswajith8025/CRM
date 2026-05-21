import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase.from('time_logs').select('*').limit(1);
  if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
  } else {
    console.log("Error or empty:", error);
    // If empty, let's just intentionally cause an error to see the columns
    const { error: err2 } = await supabase.from('time_logs').select('non_existent_column');
    console.log("Error details:", err2);
  }
}
test();
