const baseUrl = 'http://192.168.1.34:85/iclock';
const serialNumber = 'JJA1253801206';
const userName = 'Ecraftz';
const userPassword = 'Ecraftz@123';

const services = [
  'WebAPIService.asmx',
  'EmployeeService.asmx',
  'UserService.asmx',
  'DataService.asmx',
  'DeviceAPIService.asmx',
];

const actions = [
  'GetAllEmployee',
  'GetEmployeeList',
  'GetAllUser',
  'GetAllUserInfo',
  'GetUserInfo',
  'GetEmployees',
  'GetAllStaff',
  'GetStaffInfo',
  'GetPersonnel',
  'GetAllPersonnel',
];

async function tryAction(service, action) {
  const url = `${baseUrl}/${service}`;
  const soap = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action} xmlns="http://tempuri.org/">
      <SerialNumber>${serialNumber}</SerialNumber>
      <UserName>${userName}</UserName>
      <UserPassword>${userPassword}</UserPassword>
      <strDataList></strDataList>
    </${action}>
  </soap:Body>
</soap:Envelope>`;

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `"http://tempuri.org/${action}"`,
      },
      body: soap,
    });
    const t = await r.text();
    if (!t.includes('did not recognize') && !t.includes('faultstring')) {
      console.log(`✅ [${service}] ${action}:`);
      console.log(t.substring(0, 400));
      console.log('---');
    }
  } catch (e) {
    // silent
  }
}

async function main() {
  for (const service of services) {
    for (const action of actions) {
      await tryAction(service, action);
    }
  }
  console.log('Done probing.');
}

main();
