import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url + '/rest/v1/leave_requests', {
    method: 'GET',
    headers: { 'apikey': anon, 'Authorization': 'Bearer ' + anon }
  });
  console.log('GET anon status:', res.status);
}
run();
