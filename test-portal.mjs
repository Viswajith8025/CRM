// Probe the eTimeTrackLite web portal for login and employee endpoints
const base = 'http://192.168.1.34:85';

async function tryGet(path) {
  try {
    const r = await fetch(`${base}${path}`, { redirect: 'manual' });
    const t = await r.text();
    console.log(`GET ${path} -> ${r.status}`);
    if (r.status === 200 && !t.includes('RedirectToHome') && t.length > 100) {
      console.log('  Preview:', t.substring(0, 300).replace(/\s+/g, ' '));
    }
  } catch (e) {
    console.log(`GET ${path} -> ERROR:`, e.message);
  }
}

async function tryLogin() {
  const loginPaths = [
    '/iclock/accounts/login/',
    '/iclock/login/',
    '/iclock/Login.aspx',
    '/iclock/Default.aspx',
  ];
  
  for (const path of loginPaths) {
    try {
      const r = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `username=admin&password=admin`,
        redirect: 'manual',
      });
      console.log(`POST ${path} -> ${r.status}, Location: ${r.headers.get('location') || 'none'}`);
      const cookies = r.headers.get('set-cookie');
      if (cookies) console.log('  Cookies:', cookies.substring(0, 200));
    } catch (e) {
      console.log(`POST ${path} -> ERROR:`, e.message);
    }
  }
}

async function main() {
  console.log('=== Probing Portal Paths ===');
  const paths = [
    '/iclock/',
    '/iclock/accounts/login/',
    '/iclock/employee/',
    '/iclock/personnel/employee/',
    '/iclock/att/employee/',
    '/iclock/api/employee/',
    '/iclock/WebReport/employee.aspx',
    '/iclock/report/employee',
    '/iclock/employee/list/',
    '/iclock/devicemanage/device/',
  ];
  for (const p of paths) await tryGet(p);
  
  console.log('\n=== Trying Login ===');
  await tryLogin();
}

main();
