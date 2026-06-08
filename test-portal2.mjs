// Try to authenticate to eTimeTrackLite and fetch employee data
const base = 'http://192.168.1.34:85';

// First, probe what WebReport pages exist
async function probeWebReport() {
  const pages = [
    '/iclock/WebReport/',
    '/iclock/WebReport/Default.aspx',
    '/iclock/WebReport/LogReport.aspx',
    '/iclock/WebReport/StaffInfo.aspx',
    '/iclock/WebReport/EmployeeInfo.aspx',
    '/iclock/WebReport/PersonInfo.aspx',
  ];
  
  for (const p of pages) {
    try {
      const r = await fetch(`${base}${p}`, { redirect: 'manual' });
      const t = await r.text();
      console.log(`${p} -> ${r.status}`);
      if (r.status === 200) {
        console.log('  Preview:', t.substring(0, 500).replace(/\s+/g, ' '));
      }
    } catch (e) {
      console.log(`${p} -> ERROR`);
    }
  }
}

// Try the Default.aspx login form approach
async function tryDefaultLogin() {
  // First get the login page to get any form tokens
  const loginR = await fetch(`${base}/iclock/Default.aspx`);
  const loginHtml = await loginR.text();
  const cookieHeader = loginR.headers.get('set-cookie') || '';
  
  // Extract viewstate and eventvalidation
  const vsMatch = loginHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const evMatch = loginHtml.match(/id="__EVENTVALIDATION"\s+value="([^"]+)"/);
  const vsGen = loginHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);
  
  console.log('ViewState found:', !!vsMatch);
  console.log('EventValidation found:', !!evMatch);
  
  // Try form inputs available
  const inputs = [...loginHtml.matchAll(/name="([^"]+)"[^>]*type="([^"]+)"/g)].map(m => `${m[1]}(${m[2]})`);
  console.log('Form inputs:', inputs);
  
  const body = new URLSearchParams();
  if (vsMatch) body.set('__VIEWSTATE', vsMatch[1]);
  if (evMatch) body.set('__EVENTVALIDATION', evMatch[1]);
  if (vsGen) body.set('__VIEWSTATEGENERATOR', vsGen[1]);
  body.set('txtUsername', 'Ecraftz');
  body.set('txtPassword', 'Ecraftz@123');
  body.set('btnLogin', 'Login');
  
  const r = await fetch(`${base}/iclock/Default.aspx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookieHeader.split(';')[0],
    },
    body: body.toString(),
    redirect: 'manual',
  });
  
  console.log('\nLogin attempt:', r.status, 'Location:', r.headers.get('location'));
  console.log('Set-Cookie:', r.headers.get('set-cookie'));
  
  const authCookie = (r.headers.get('set-cookie') || '').split(';')[0];
  
  if (authCookie && !authCookie.includes('expires=')) {
    // Try fetching employee data with this cookie
    const empR = await fetch(`${base}/iclock/WebReport/StaffInfo.aspx`, {
      headers: { 'Cookie': authCookie },
      redirect: 'manual',
    });
    console.log('\nEmployee page:', empR.status);
    if (empR.status === 200) {
      const t = await empR.text();
      console.log(t.substring(0, 1000));
    }
  }
}

async function main() {
  console.log('=== WebReport Pages ===');
  await probeWebReport();
  console.log('\n=== Login Attempt ===');
  await tryDefaultLogin();
}

main().catch(console.error);
