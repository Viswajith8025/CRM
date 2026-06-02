import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  
  const res = await fetch(url + '/rest/v1/leave_requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anon,
      'Authorization': 'Bearer ' + anon
    },
    body: JSON.stringify({
      organization_id: '00000000-0000-0000-0000-000000000000',
      user_id: '00000000-0000-0000-0000-000000000000',
      leave_type_id: 'd82a9994-03d5-48e2-bda2-29e3f7c29b07',
      start_date: '2026-06-10',
      end_date: '2026-06-11',
      reason: 'test',
      is_emergency: false,
      status: 'pending'
    })
  });
  console.log('POST status:', res.status);
  console.log('Body:', await res.text());
}
run();
