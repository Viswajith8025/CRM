export interface ESSLConfig {
  url: string;
  apiKey?: string;
  userName?: string;
  userPassword?: string;
}

export class ESSLService {
  private config: ESSLConfig;

  constructor(config: ESSLConfig) {
    this.config = config;
  }

  private async makeSoapRequest(actionName: string, body: string): Promise<string> {
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;

    try {
      // DO NOT append ?op= to the URL. ASMX POST requests with ?op= trigger the HTTP POST binding 
      // instead of SOAP 1.1, causing the server to ignore the XML body entirely!
      const fetchUrl = this.config.url.split('?')[0]; 
      
      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `"http://tempuri.org/${actionName}"`,
        },
        body: soapEnvelope,
      });

      const responseText = await response.text();
      
      if (!response.ok) {
        // ASMX 500 errors usually return a SOAP Fault containing the actual error message
        let faultMsg = `HTTP error! status: ${response.status}`;
        try {
          const faultMatch = responseText.match(/<faultstring>(.*?)<\/faultstring>/i);
          if (faultMatch) faultMsg = faultMatch[1];
        } catch (e) {}
        throw new Error(`${faultMsg} | Raw Response: ${responseText}`);
      }

      return responseText;
    } catch (error) {
      console.error(`eSSL API Error (${actionName}):`, error);
      throw error;
    }
  }

  private extractResult(xml: string, resultTag: string): string | null {
    // Use [\\s\\S]*? to capture multiline content correctly across all JS environments
    const regex = new RegExp(`<${resultTag}>([\\s\\S]*?)</${resultTag}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }

  async addEmployee(employeeCode: string, employeeName: string, cardNumber: string, serialNumber: string, commandId: number = 1): Promise<string | null> {
    const body = `<AddEmployee xmlns="http://tempuri.org/">
      <APIKey>${this.config.apiKey || 'string'}</APIKey>
      <EmployeeCode>${employeeCode}</EmployeeCode>
      <EmployeeName>${employeeName}</EmployeeName>
      <CardNumber>${cardNumber}</CardNumber>
      <SerialNumber>${serialNumber}</SerialNumber>
      <UserName>${this.config.userName || ''}</UserName>
      <UserPassword>${this.config.userPassword || ''}</UserPassword>
      <CommandId>${commandId}</CommandId>
    </AddEmployee>`;

    const response = await this.makeSoapRequest('AddEmployee', body);
    return this.extractResult(response, 'AddEmployeeResult');
  }

  async blockUnblockUser(employeeCode: string, employeeName: string, serialNumber: string, isBlock: boolean, commandId: string = "1"): Promise<string | null> {
    const body = `<BlockUnblockUser xmlns="http://tempuri.org/">
      <APIKey>${this.config.apiKey || 'string'}</APIKey>
      <EmployeeCode>${employeeCode}</EmployeeCode>
      <EmployeeName>${employeeName}</EmployeeName>
      <SerialNumber>${serialNumber}</SerialNumber>
      <IsBlock>${isBlock}</IsBlock>
      <UserName>${this.config.userName || ''}</UserName>
      <UserPassword>${this.config.userPassword || ''}</UserPassword>
      <CommandId>${commandId}</CommandId>
    </BlockUnblockUser>`;

    const response = await this.makeSoapRequest('BlockUnblockUser', body);
    return this.extractResult(response, 'BlockUnblockUserResult');
  }

  async deleteUser(employeeCode: string, serialNumber: string, commandId: string = "1"): Promise<string | null> {
    const body = `<DeleteUser xmlns="http://tempuri.org/">
      <APIKey>${this.config.apiKey || 'string'}</APIKey>
      <EmployeeCode>${employeeCode}</EmployeeCode>
      <SerialNumber>${serialNumber}</SerialNumber>
      <UserName>${this.config.userName || ''}</UserName>
      <UserPassword>${this.config.userPassword || ''}</UserPassword>
      <CommandId>${commandId}</CommandId>
    </DeleteUser>`;

    const response = await this.makeSoapRequest('DeleteUser', body);
    return this.extractResult(response, 'DeleteUserResult');
  }

  async getCommandStatus(commandId: string): Promise<string | null> {
    const body = `<GetCommandStatus xmlns="http://tempuri.org/">
      <CommandId>${commandId}</CommandId>
      <UserName>${this.config.userName || ''}</UserName>
      <UserPassword>${this.config.userPassword || ''}</UserPassword>
    </GetCommandStatus>`;

    const response = await this.makeSoapRequest('GetCommandStatus', body);
    return this.extractResult(response, 'GetCommandStatusResult');
  }

  async getTransactionsLog(fromDate: string, toDate: string, serialNumber: string, strDataList: string = ""): Promise<string | null> {
    const body = `<GetTransactionsLog xmlns="http://tempuri.org/">
      <FromDateTime>${fromDate}</FromDateTime>
      <ToDateTime>${toDate}</ToDateTime>
      <SerialNumber>${serialNumber}</SerialNumber>
      <UserName>${this.config.userName || ''}</UserName>
      <UserPassword>${this.config.userPassword || ''}</UserPassword>
      <strDataList>${strDataList}</strDataList>
    </GetTransactionsLog>`;
    
    const response = await this.makeSoapRequest('GetTransactionsLog', body);
    const result = this.extractResult(response, 'GetTransactionsLogResult');
    const dataList = this.extractResult(response, 'strDataList');
    
    if (result && result.includes('Logs Count:') && dataList) {
      return result + '\n' + dataList;
    }
    return dataList || result;
  }

  async getAllEmployees(serialNumber: string, strDataList: string = ""): Promise<string | null> {
    const body = `<GetAllEmployee xmlns="http://tempuri.org/">
      <SerialNumber xmlns="">${serialNumber}</SerialNumber>
      <UserName xmlns="">${this.config.userName || ''}</UserName>
      <UserPassword xmlns="">${this.config.userPassword || ''}</UserPassword>
      <strDataList xmlns="">${strDataList}</strDataList>
    </GetAllEmployee>`;
    
    const response = await this.makeSoapRequest('GetAllEmployee', body);
    const result = this.extractResult(response, 'GetAllEmployeeResult');
    const dataList = this.extractResult(response, 'strDataList');
    return dataList || result;
  }
}
