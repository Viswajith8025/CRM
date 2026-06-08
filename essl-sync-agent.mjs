import { createClient } from '@supabase/supabase-js';

// ==========================================
// 1. CONFIGURATION
// ==========================================
const ESSL_DEVICE_URL = 'http://192.168.1.34:85/iclock/WebAPIService.asmx';
const DEVICE_SERIAL_NUMBER = 'JJA1253801206'; // Replace with your device serial
const DEVICE_USERNAME = 'essl'; // Leave blank if not required
const DEVICE_PASSWORD = 'Inax@2025'; // Leave blank if not required

// Supabase Configuration (From your .env file)
const SUPABASE_URL = 'https://vbosonyrosxfttyoengz.supabase.co';
const SUPABASE_SERVICE_KEY = 'YOUR_SUPABASE_SERVICE_ROLE_KEY'; // Use Service Role Key for backend scripts!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ==========================================
// 2. SOAP FETCH LOGIC
// ==========================================
async function fetchDeviceLogs(fromDate, toDate) {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>${fromDate}</FromDateTime>
      <ToDateTime>${toDate}</ToDateTime>
      <SerialNumber>${DEVICE_SERIAL_NUMBER}</SerialNumber>
      <UserName>${DEVICE_USERNAME}</UserName>
      <UserPassword>${DEVICE_PASSWORD}</UserPassword>
      <strDataList></strDataList>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;

  try {
    const response = await fetch(ESSL_DEVICE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tempuri.org/GetTransactionsLog"',
      },
      body: soapEnvelope,
    });

    const responseText = await response.text();
    
    // Extract the raw result string from the XML wrapper
    const regex = /<GetTransactionsLogResult>([\s\S]*?)<\/GetTransactionsLogResult>/i;
    const match = responseText.match(regex);
    
    if (match) {
      return match[1].trim();
    } else {
      console.error('Failed to parse result from device. Raw response:', responseText.substring(0, 500));
      return null;
    }
  } catch (error) {
    console.error('Connection to device failed:', error.message);
    return null;
  }
}

// ==========================================
// 3. MAIN SYNC LOOP
// ==========================================
async function runSync() {
  console.log(`\n[${new Date().toISOString()}] Starting Attendance Sync...`);
  
  // By default, fetch logs for today
  const today = new Date().toISOString().split('T')[0];
  const fromDate = `${today} 00:00`;
  const toDate = `${today} 23:59`;

  const rawLogs = await fetchDeviceLogs(fromDate, toDate);

  if (!rawLogs) {
    console.log('No logs found or device is offline.');
    return;
  }

  // TODO: We will parse the rawLogs here and push them to Supabase!
  console.log('==== RAW LOGS FETCHED ====');
  console.log(rawLogs);
  console.log('==========================');
  console.log('Next step: Parsing these logs and pushing to Supabase...');
}

// Run immediately, then run every 10 minutes (600,000 milliseconds)
runSync();
setInterval(runSync, 600000);

console.log('eSSL Local Sync Agent is running! Press Ctrl+C to stop.');
