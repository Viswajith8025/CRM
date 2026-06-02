import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const res = await fetch(url + '/rest/v1/leave_requests', {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'apikey,authorization,content-type,prefer,x-client-info'
    }
  });
  console.log('Preflight status:', res.status);
}
run();
