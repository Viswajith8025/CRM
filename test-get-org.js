import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: { user }, error: err1 } = await supabase.auth.admin.createUser({
    email: 'test_get_my_org_id@example.com',
    password: 'password123',
    email_confirm: true,
  });
  
  if (err1) {
    console.error('Create user error:', err1);
    return;
  }
  
  const { data: { session }, error: err2 } = await supabase.auth.signInWithPassword({
    email: 'test_get_my_org_id@example.com',
    password: 'password123'
  });
  
  if (err2) {
    console.error('Sign in error:', err2);
    return;
  }
  
  const userClient = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`
      }
    }
  });
  
  const { error: err3 } = await userClient
    .from('tasks')
    .update({ status: 'in_progress' })
    .eq('id', '11111111-1111-1111-1111-111111111111')
    .eq('organization_id', '00000000-0000-0000-0000-000000000000')
    .select()
    .single();
    
  console.log('Update Error for new user:', err3);
  
  await supabase.auth.admin.deleteUser(user.id);
}

main();
