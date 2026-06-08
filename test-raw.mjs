const url = 'http://192.168.1.34:85/iclock/WebAPIService.asmx';
const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>2026-06-01 00:00</FromDateTime>
      <ToDateTime>2026-06-08 23:59</ToDateTime>
      <SerialNumber>JJA1253801206</SerialNumber>
      <UserName>Ecraftz</UserName>
      <UserPassword>Ecraftz@123</UserPassword>
      <strDataList></strDataList>
    </GetTransactionsLog>
  </soap:Body>
</soap:Envelope>`;

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': '"http://tempuri.org/GetTransactionsLog"'
  },
  body: soapEnvelope
})
.then(r => r.text())
.then(t => console.log(t.substring(0, 1000))) // Print first 1000 chars
.catch(console.error);
