import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbosonyrosxfttyoengz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZib3Nvbnlyb3N4ZnR0eW9lbmd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTU3MDQsImV4cCI6MjA5MjkzMTcwNH0.OyJKw9QvXyp3DcnR_lYkc0ID9O64bnvk521hRtW1DcE';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
  console.log("Running form_submissions query test with updated clients select...");
  
  // Test query: without client company
  const { data, error } = await supabase
    .from('form_submissions')
    .select(`
      *,
      template:form_templates (*),
      lead:leads!lead_id (first_name, last_name, company),
      client:clients!client_id (name)
    `)
    .limit(1);

  console.log("Query result:", { hasData: !!data, error });
}

testQuery();
