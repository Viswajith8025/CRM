import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  
  const res1 = await fetch(url + '/rest/v1/rpc/submit_leave_request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anon,
      'Authorization': 'Bearer ' + anon
    },
    body: JSON.stringify({
      p_leave_type_id: '',
      p_start_date: '2026-06-10',
      p_end_date: '2026-06-11',
      p_reason: 'test',
      p_is_emergency: false
    })
  });
  console.log('Status with empty string UUID:', res1.status);
  console.log(await res1.text());
}
run();
