import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const url = process.env.VITE_SUPABASE_URL;
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  
  // Test 1: Raw fetch to RPC endpoint (exactly what the browser does)
  console.log('--- Test 1: Raw fetch to RPC endpoint ---');
  const res1 = await fetch(url + '/rest/v1/rpc/submit_leave_request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anon,
      'Authorization': 'Bearer ' + anon
    },
    body: JSON.stringify({
      p_leave_type_id: 'd82a9994-03d5-48e2-bda2-29e3f7c29b07',
      p_start_date: '2026-06-10',
      p_end_date: '2026-06-11',
      p_reason: 'Test',
      p_is_emergency: false
    })
  });
  console.log('Status:', res1.status, res1.statusText);
  const body1 = await res1.text();
  console.log('Body:', body1);

  // Test 2: Raw fetch to direct table insert
  console.log('\n--- Test 2: Raw fetch to direct table insert ---');
  const res2 = await fetch(url + '/rest/v1/leave_requests', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': anon,
      'Authorization': 'Bearer ' + anon,
      'Prefer': 'return=minimal'
    },
    body: JSON.stringify({
      organization_id: '00000000-0000-0000-0000-000000000001',
      user_id: '00000000-0000-0000-0000-000000000001',
      leave_type_id: 'd82a9994-03d5-48e2-bda2-29e3f7c29b07',
      start_date: '2026-06-10',
      end_date: '2026-06-11',
      reason: 'Test',
      is_emergency: false,
      status: 'pending'
    })
  });
  console.log('Status:', res2.status, res2.statusText);
  const body2 = await res2.text();
  console.log('Body:', body2);

  // Test 3: Check if the table is exposed via OpenAPI
  console.log('\n--- Test 3: Check OpenAPI schema ---');
  const res3 = await fetch(url + '/rest/v1/', {
    headers: { 'apikey': anon }
  });
  const schema = await res3.json();
  const hasLeaveRequests = !!schema.paths?.['/leave_requests'];
  const hasRpc = !!schema.paths?.['/rpc/submit_leave_request'];
  console.log('Table /leave_requests in API:', hasLeaveRequests);
  console.log('RPC /rpc/submit_leave_request in API:', hasRpc);
  
  if (!hasLeaveRequests) {
    console.log('\n!!! ROOT CAUSE FOUND !!!');
    console.log('The leave_requests table is NOT exposed in the PostgREST API schema.');
    console.log('This means PostgREST cannot see it, regardless of grants or RLS.');
    // List all paths to see what IS exposed
    const allPaths = Object.keys(schema.paths || {}).filter(p => p.includes('leave'));
    console.log('Leave-related paths found:', allPaths.length ? allPaths : 'NONE');
  }
}
run().catch(console.error);
