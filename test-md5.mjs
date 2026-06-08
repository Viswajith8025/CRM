import crypto from 'crypto';

const ESSL_DEVICE_URL = 'http://192.168.1.34:85/iclock/WebAPIService.asmx';
const md5 = crypto.createHash('md5').update('Inax@2025').digest('hex');

async function run() {
  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>2026-06-05 00:00</FromDateTime>
      <ToDateTime>2026-06-05 23:59</ToDateTime>
      <SerialNumber>JJA1253801206</SerialNumber>
      <UserName>essl</UserName>
      <UserPassword>${md5}</UserPassword>
      <strDataList></strDataList>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;

  const response = await fetch(ESSL_DEVICE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '"http://tempuri.org/GetTransactionsLog"',
    },
    body: soapEnvelope,
  });

  console.log('MD5 test:', await response.text());
}

run();
