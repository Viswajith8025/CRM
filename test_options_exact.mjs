import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const res = await fetch(url + '/rest/v1/leave_requests', {
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'apikey,authorization,content-profile,content-type,prefer,x-client-info'
    }
  });
  console.log('OPTIONS exact status:', res.status);
}
run();
