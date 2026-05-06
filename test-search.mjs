import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTU3MDQsImV4cCI6MjA5MjkzMTcwNH0.OyJKw9QvXyp3DcnR_lYkc0ID9O64bnvk521hRtW1DcE';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSearch(query) {
  // Try to sign in as admin
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'viswajithjithu333@gmail.com',
    password: 'password123' // Or whatever default password they use, or just use the service role key instead.
  });
  
  if (authError) {
    console.error('Auth error:', authError);
    // Even without auth, let's just query to see if ANY row has that name.
  } else {
    console.log('Authenticated as:', authData.user.email);
  }

  const term = `%${query}%`;
  console.log(`Searching for term: ${term}`);

  const { data: allProjects } = await supabase.from('projects').select('name');
  console.log('All projects names:', allProjects?.map(p => p.name));

  const [projects] = await Promise.all([
    supabase.from('projects').select('id, name').ilike('name', term).limit(5)
  ]);

  console.log('\n--- PROJECTS MATCHING ---');
  if (projects.error) console.error(projects.error);
  else console.log(projects.data);
}

testSearch('aliya');
