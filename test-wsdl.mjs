import fs from 'fs';
fetch('http://192.168.1.34:85/iclock/WebAPIService.asmx?WSDL')
  .then(r => r.text())
  .then(t => {
    const matches = [...t.matchAll(/<wsdl:operation name="([^"]+)"/g)].map(m => m[1]);
    console.log(Array.from(new Set(matches)));
  })
  .catch(console.error);
