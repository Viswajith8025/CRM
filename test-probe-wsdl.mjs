const urls = [
  'http://192.168.1.34:85/iclock/DeviceAPIService.asmx?WSDL',
  'http://192.168.1.34:85/iclock/DataService.asmx?WSDL',
  'http://192.168.1.34:85/iclock/EmployeeService.asmx?WSDL',
  'http://192.168.1.34:85/iclock/UserService.asmx?WSDL',
];

async function checkUrls() {
  for (const u of urls) {
    try {
      const r = await fetch(u);
      const t = await r.text();
      const ops = [...t.matchAll(/<wsdl:operation name="([^"]+)"/g)].map(m => m[1]);
      console.log(u, [...new Set(ops)]);
    } catch (e) {
      console.log(u, 'error');
    }
  }
}
checkUrls();
