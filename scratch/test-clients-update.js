import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { parseClientMetadata, serializeClientMetadata } from '../src/lib/metadataFallback.ts';

// Parse .env manually to ensure variables are loaded in Node.js environment
const envPath = path.resolve('.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Remove surrounding quotes if any
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing in .env!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpdate() {
  console.log("Fetching a client from Supabase...");
  const { data: clients, error: fetchError } = await supabase.from('clients').select('*').limit(1);
  
  if (fetchError) {
    console.error("Error fetching clients:", fetchError);
    process.exit(1);
  }
  
  if (!clients || clients.length === 0) {
    console.log("No clients found in database to test update on.");
    process.exit(0);
  }
  
  const rawClient = clients[0];
  console.log("\nRaw Client from DB:", {
    id: rawClient.id,
    name: rawClient.name,
    address: rawClient.address,
    department_id: rawClient.department_id,
    team_lead_id: rawClient.team_lead_id
  });
  
  // 1. Simulate parsing client metadata (just like fetchClients does)
  const parsedMetadata = parseClientMetadata(rawClient);
  const currentClient = {
    ...rawClient,
    ...parsedMetadata
  };
  
  console.log("\nParsed Client in Zustand state (currentClient):", {
    id: currentClient.id,
    name: currentClient.name,
    address: currentClient.address,
    department_id: currentClient.department_id,
    team_lead_id: currentClient.team_lead_id,
    __has_db_columns: currentClient.__has_db_columns
  });
  
  // 2. Simulate client form submitting updates (changing name and setting department_id/team_lead_id)
  const updates = {
    name: currentClient.name + " (Test)",
    department_id: "none_assigned",
    team_lead_id: "none_assigned"
  };
  
  const sanitizedUpdates = {
    ...updates,
    department_id: updates.department_id === "none_assigned" ? "" : updates.department_id,
    team_lead_id: updates.team_lead_id === "none_assigned" ? "" : updates.team_lead_id,
  };
  
  console.log("\nUpdates from Form:", sanitizedUpdates);
  
  // 3. Simulate updateClient logic in crmStore.ts
  const { department_id, team_lead_id, ...cleanUpdates } = sanitizedUpdates;
  const fullClient = {
    ...currentClient,
    ...cleanUpdates
  };
  
  console.log("\nfullClient passed to serializer:", {
    id: fullClient.id,
    name: fullClient.name,
    address: fullClient.address,
    department_id: fullClient.department_id,
    team_lead_id: fullClient.team_lead_id,
    __has_db_columns: fullClient.__has_db_columns
  });
  
  const processedClient = serializeClientMetadata(
    fullClient,
    department_id !== undefined ? department_id : currentClient.department_id,
    team_lead_id !== undefined ? team_lead_id : currentClient.team_lead_id
  );
  
  console.log("\nprocessedClient returned from serializer:", {
    id: processedClient.id,
    name: processedClient.name,
    address: processedClient.address,
    department_id: processedClient.department_id,
    team_lead_id: processedClient.team_lead_id
  });
  
  const finalUpdates = {
    ...cleanUpdates,
    address: processedClient.address,
    ...( ('department_id' in processedClient) ? { department_id: processedClient.department_id, team_lead_id: processedClient.team_lead_id } : {} )
  };
  
  console.log("\nfinalUpdates update payload to Supabase:", finalUpdates);
  
  // 4. Perform the update query in Supabase!
  console.log("\nSending UPDATE query to Supabase...");
  const { data: updatedData, error: updateError } = await supabase
    .from('clients')
    .update(finalUpdates)
    .eq('id', rawClient.id)
    .select();
    
  if (updateError) {
    console.error("\n❌ UPDATE FAILED!", updateError);
  } else {
    console.log("\n✅ UPDATE SUCCEEDED!", updatedData[0]);
    
    // Clean up the name by restoring it to original
    console.log("\nCleaning up (restoring original name)...");
    const restoreUpdates = {
      ...finalUpdates,
      name: rawClient.name,
      address: rawClient.address // restore original address column
    };
    await supabase.from('clients').update(restoreUpdates).eq('id', rawClient.id);
    console.log("Cleanup complete.");
  }
}

testUpdate();
