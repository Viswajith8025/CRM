import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url + '/rest/v1/leave_requests', {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-client-info,apikey,authorization'
    }
  });
  console.log('OPTIONS table status:', res.status);
}
run();
