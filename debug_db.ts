import { supabase } from './src/lib/supabase';

async function debugData() {
  console.log('--- Debugging Database State ---');

  // 1. Check current session/user
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    console.log('No active session found.');
    return;
  }
  const user = session.user;
  console.log('User ID:', user.id);

  // 2. Check profile and organization_id
  const { data: profile, error: pError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  if (pError) {
    console.error('Error fetching profile:', pError);
  } else {
    console.log('Profile Org ID:', profile.organization_id);
    console.log('Profile Role:', profile.role);
  }

  // 3. Check Leads count
  const { count: leadCount, error: lError } = await supabase
    .from('leads')
    .select('*', { count: 'exact', head: true });
  
  console.log('Leads Visible to User:', lError ? `Error: ${lError.message}` : leadCount);

  // 4. Check Invoices count and Paid amount
  const { data: invoices, error: iError } = await supabase
    .from('invoices')
    .select('status, amount');
  
  if (iError) {
    console.error('Error fetching invoices:', iError);
  } else {
    const paidRevenue = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    console.log('Invoices Found:', invoices.length);
    console.log('Total Paid Revenue:', paidRevenue);
  }

  // 5. Check if campaign_id exists on leads
  const { data: leadCols, error: cError } = await supabase
    .from('leads')
    .select('*')
    .limit(1);
  
  if (leadCols && leadCols.length > 0) {
    console.log('Lead keys:', Object.keys(leadCols[0]));
  }
}

debugData();
