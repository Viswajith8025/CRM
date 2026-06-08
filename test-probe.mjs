const urls = [
  'http://192.168.1.34:85/iclock/WebAPIService.asmx',
  'http://192.168.1.34:85/iclock/DeviceAPIService.asmx',
  'http://192.168.1.34:85/iclock/DataService.asmx',
  'http://192.168.1.34:85/iclock/EmployeeService.asmx',
  'http://192.168.1.34:85/iclock/UserService.asmx',
  'http://192.168.1.34:85/WebAPIService.asmx',
  'http://192.168.1.34:85/iclock/api/employees',
];

async function checkUrls() {
  for (const u of urls) {
    try {
      const r = await fetch(u);
      console.log(u, r.status);
    } catch (e) {
      console.log(u, 'error');
    }
  }
}
checkUrls();
