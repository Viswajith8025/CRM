import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  
  const res = await fetch(url + '/rest/v1/leave_requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': 'Bearer ' + serviceKey
    },
    body: JSON.stringify([{
      organization_id: '8a7d3a04-51bc-40d3-ba6b-648b26002f23',
      user_id: '8a7d3a04-51bc-40d3-ba6b-648b26002f23',
      leave_type_id: '',
      start_date: '2026-06-10',
      end_date: '2026-06-11',
      reason: 'test',
      is_emergency: false,
      status: 'pending'
    }])
  });
  console.log('POST empty uuid status:', res.status);
  console.log('Body:', await res.text());
}
run();
