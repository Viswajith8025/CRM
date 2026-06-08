const base = 'http://192.168.1.34:85';

async function main() {
  // Step 1: Get initial page + session cookie
  const loginPage = await fetch(`${base}/iclock/Default.aspx`);
  const loginHtml = await loginPage.text();
  const sessionCookie = (loginPage.headers.get('set-cookie') || '').split(';')[0];
  console.log('Session cookie:', sessionCookie);

  const vsMatch = loginHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const vsGen = loginHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

  // Step 2: Login with 302 and follow redirect manually
  const body = new URLSearchParams();
  if (vsMatch) body.set('__VIEWSTATE', vsMatch[1]);
  if (vsGen) body.set('__VIEWSTATEGENERATOR', vsGen[1]);
  body.set('StaffloginDialog$txt_LoginName', 'Ecraftz');
  body.set('StaffloginDialog$Txt_Password', 'Ecraftz@123');
  body.set('StaffloginDialog$Btn_Ok', 'Login');

  const loginRes = await fetch(`${base}/iclock/Default.aspx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': sessionCookie,
    },
    body: body.toString(),
    redirect: 'manual',
  });

  const location = loginRes.headers.get('location');
  const rawCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [];
  console.log('Login redirect to:', location);
  console.log('Raw new cookies:', rawCookies);
  
  // Build cookie jar
  const cookieJar = new Map();
  sessionCookie.split('=').length > 1 && cookieJar.set(sessionCookie.split('=')[0], sessionCookie.split('=').slice(1).join('='));
  rawCookies.forEach(c => {
    const [kv] = c.split(';');
    const [k, v] = kv.split('=');
    cookieJar.set(k.trim(), v?.trim() || '');
  });
  
  const cookieString = [...cookieJar.entries()].map(([k,v]) => `${k}=${v}`).join('; ');
  console.log('Cookie jar:', cookieString);

  // Follow redirect if any
  if (location) {
    const redirectUrl = location.startsWith('http') ? location : `${base}${location}`;
    const r2 = await fetch(redirectUrl, {
      headers: { 'Cookie': cookieString },
      redirect: 'manual',
    });
    const r2Cookies = r2.headers.getSetCookie ? r2.headers.getSetCookie() : [];
    r2Cookies.forEach(c => {
      const [kv] = c.split(';');
      const [k, v] = kv.split('=');
      cookieJar.set(k.trim(), v?.trim() || '');
    });
    console.log('Redirect status:', r2.status, 'New loc:', r2.headers.get('location'));
    console.log('Updated cookie jar:', [...cookieJar.entries()].map(([k,v]) => `${k}=${v}`).join('; '));
  }

  const finalCookies = [...cookieJar.entries()].map(([k,v]) => `${k}=${v}`).join('; ');
  
  // Step 3: Try the staff info page
  const staffR = await fetch(`${base}/iclock/WebReport/StaffInfo.aspx`, {
    headers: { 
      'Cookie': finalCookies,
      'Referer': `${base}/iclock/Default.aspx`,
    },
    redirect: 'manual',
  });
  
  console.log('\nStaffInfo status:', staffR.status, 'Location:', staffR.headers.get('location'));
  if (staffR.status === 200) {
    const t = await staffR.text();
    // Extract table data
    const rows = [...t.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].slice(0, 10);
    rows.forEach(r => {
      const cells = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(c => c[1].replace(/<[^>]+>/g, '').trim()).filter(Boolean);
      if (cells.length > 0) console.log('Row:', cells.join(' | '));
    });
  }
}

main().catch(console.error);
