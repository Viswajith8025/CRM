import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.rpc('get_aggregated_dashboard_data', {
    p_org_id: '00000000-0000-0000-0000-000000000000',
    p_start_date: null,
    p_end_date: null
  });
  console.log("Error details:", JSON.stringify(error, null, 2));
}
test();
