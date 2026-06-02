import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY);
  
  // We can query the information_schema using RPC if we have one, but we don't.
  // Wait, if the table exists, a simple GET request directly to it might work if we have the right name.
  // Let's try GET /rest/v1/leave_requests
  const res = await fetch(process.env.VITE_SUPABASE_URL + '/rest/v1/leave_requests', {
    headers: { 'apikey': process.env.VITE_SUPABASE_SERVICE_ROLE_KEY }
  });
  console.log('GET /leave_requests status:', res.status);
  
  // If it's 404, the table is DEFINITELY NOT EXPOSED.
}
run();
