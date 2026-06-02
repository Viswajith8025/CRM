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
    body: '"invalid_body_string"'
  });
  console.log('POST string status:', res.status);
  console.log('Body:', await res.text());
}
run();
