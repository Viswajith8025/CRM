import dotenv from 'dotenv';
dotenv.config();
async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url + '/rest/v1/rpc/submit_leave_request', {
    method: 'OPTIONS',
    headers: {
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-client-info,apikey,authorization'
    }
  });
  console.log('OPTIONS status:', res.status);
}
run();
