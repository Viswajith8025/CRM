const base = 'http://192.168.1.34:85';

async function main() {
  // Step 1: Get login page and session cookie
  const loginPage = await fetch(`${base}/iclock/Default.aspx`);
  const loginHtml = await loginPage.text();
  const sessionCookie = (loginPage.headers.get('set-cookie') || '').split(';')[0];

  // Extract viewstate
  const vsMatch = loginHtml.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const vsGen = loginHtml.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

  // Step 2: POST login with correct field names
  const body = new URLSearchParams();
  if (vsMatch) body.set('__VIEWSTATE', vsMatch[1]);
  if (vsGen) body.set('__VIEWSTATEGENERATOR', vsGen[1]);
  body.set('StaffloginDialog$txt_LoginName', 'Ecraftz');
  body.set('StaffloginDialog$Txt_Password', 'Ecraftz@123');
  // Look for submit button name
  const btnMatch = loginHtml.match(/name="(StaffloginDialog[^"]*[Bb]tn[^"]*|[^"]*[Bb]tn[^"]*[Ll]ogin[^"]*)"/);
  console.log('Button name found:', btnMatch?.[1]);
  if (btnMatch) body.set(btnMatch[1], 'Login');

  const loginRes = await fetch(`${base}/iclock/Default.aspx`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': sessionCookie,
    },
    body: body.toString(),
    redirect: 'manual',
  });

  console.log('Login POST status:', loginRes.status);
  const newCookies = loginRes.headers.get('set-cookie');
  console.log('New cookies:', newCookies);

  // Collect all cookies
  const allCookies = [sessionCookie, ...(newCookies ? newCookies.split(',').map(c => c.split(';')[0].trim()) : [])].join('; ');
  console.log('All cookies:', allCookies);

  // Step 3: Try fetching staff list page
  const staffPages = [
    '/iclock/WebReport/StaffInfo.aspx',
    '/iclock/WebReport/LogReport.aspx',
    '/iclock/staffmanage/staff/',
    '/iclock/staff/',
    '/iclock/StaffManage/StaffInfo.aspx',
  ];

  for (const path of staffPages) {
    const r = await fetch(`${base}${path}`, {
      headers: { 'Cookie': allCookies },
      redirect: 'manual',
    });
    console.log(`\n${path} -> ${r.status}, Location: ${r.headers.get('location') || ''}`);
    if (r.status === 200) {
      const t = await r.text();
      console.log('Content preview:', t.substring(0, 500).replace(/\s+/g, ' '));
    }
  }
}

main().catch(console.error);
