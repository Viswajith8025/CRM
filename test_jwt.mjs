import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url + '/rest/v1/rpc/submit_leave_request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anon,
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.jwt'
    },
    body: JSON.stringify({
      p_leave_type_id: 'd82a9994-03d5-48e2-bda2-29e3f7c29b07',
      p_start_date: '2026-06-10',
      p_end_date: '2026-06-11',
      p_reason: 'Test',
      p_is_emergency: false
    })
  });
  console.log('Bad JWT status:', res.status);
}
run();
