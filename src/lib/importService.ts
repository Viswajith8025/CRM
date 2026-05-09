import * as XLSX from 'xlsx';
import { supabase } from './supabase';

export type ImportModule = 'leads' | 'clients' | 'invoices' | 'payments' | 'projects' | 'tasks';

export interface ImportMapping {
  excelColumn: string;
  dbField: string;
}

export interface ImportError {
  row: number;
  column: string;
  message: string;
  data: any;
}

export const MODULE_SCHEMAS: Record<ImportModule, { label: string; table: string; fields: { name: string; label: string; required: boolean; type: string }[] }> = {
  leads: {
    label: 'CRM Leads',
    table: 'leads',
    fields: [
      { name: 'first_name', label: 'First Name', required: true, type: 'string' },
      { name: 'last_name', label: 'Last Name', required: true, type: 'string' },
      { name: 'email', label: 'Email', required: true, type: 'email' },
      { name: 'phone', label: 'Phone', required: false, type: 'string' },
      { name: 'company', label: 'Company', required: false, type: 'string' },
      { name: 'status', label: 'Status', required: false, type: 'string' },
      { name: 'source', label: 'Source', required: false, type: 'string' },
    ]
  },
  clients: {
    label: 'Active Clients',
    table: 'clients',
    fields: [
      { name: 'name', label: 'Client Name', required: true, type: 'string' },
      { name: 'email', label: 'Email', required: true, type: 'email' },
      { name: 'phone', label: 'Phone', required: false, type: 'string' },
      { name: 'address', label: 'Address', required: false, type: 'string' },
      { name: 'service', label: 'Service Type', required: false, type: 'string' },
    ]
  },
  invoices: {
    label: 'Invoices',
    table: 'invoices',
    fields: [
      { name: 'invoice_number', label: 'Invoice Number', required: true, type: 'string' },
      { name: 'amount', label: 'Amount', required: true, type: 'number' },
      { name: 'status', label: 'Status', required: true, type: 'string' },
      { name: 'issued_at', label: 'Issue Date', required: true, type: 'date' },
      { name: 'due_date', label: 'Due Date', required: true, type: 'date' },
    ]
  },
  payments: {
    label: 'Payments',
    table: 'payments',
    fields: [
      { name: 'amount', label: 'Amount', required: true, type: 'number' },
      { name: 'payment_method', label: 'Method', required: true, type: 'string' },
      { name: 'paid_at', label: 'Paid Date', required: true, type: 'date' },
      { name: 'invoice_id', label: 'Invoice ID', required: false, type: 'uuid' },
    ]
  },
  projects: {
    label: 'Projects',
    table: 'projects',
    fields: [
      { name: 'name', label: 'Project Name', required: true, type: 'string' },
      { name: 'description', label: 'Description', required: false, type: 'string' },
      { name: 'status', label: 'Status', required: true, type: 'string' },
      { name: 'start_date', label: 'Start Date', required: false, type: 'date' },
      { name: 'end_date', label: 'End Date', required: false, type: 'date' },
    ]
  },
  tasks: {
    label: 'Tasks',
    table: 'tasks',
    fields: [
      { name: 'title', label: 'Task Title', required: true, type: 'string' },
      { name: 'description', label: 'Description', required: false, type: 'string' },
      { name: 'status', label: 'Status', required: true, type: 'string' },
      { name: 'priority', label: 'Priority', required: true, type: 'string' },
      { name: 'due_date', label: 'Due Date', required: false, type: 'date' },
    ]
  }
};

export class ImportService {
  static async parseFile(file: File): Promise<{ columns: string[], rows: any[] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet);
          const columns = rows.length > 0 ? Object.keys(rows[0] as any) : [];
          resolve({ columns, rows });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  }

  static autoMap(columns: string[], module: ImportModule): ImportMapping[] {
    const schema = MODULE_SCHEMAS[module];
    const mappings: ImportMapping[] = [];

    columns.forEach(col => {
      const normalizedCol = col.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = schema.fields.find(field => {
        const normalizedField = field.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normalizedLabel = field.label.toLowerCase().replace(/[^a-z0-9]/g, '');
        return normalizedCol === normalizedField || normalizedCol === normalizedLabel;
      });

      if (match) {
        mappings.push({ excelColumn: col, dbField: match.name });
      }
    });

    return mappings;
  }

  static validate(rows: any[], mappings: ImportMapping[], module: ImportModule): { validRows: any[], errors: ImportError[] } {
    const schema = MODULE_SCHEMAS[module];
    const validRows: any[] = [];
    const errors: ImportError[] = [];

    rows.forEach((row, index) => {
      const mappedRow: any = {};
      let rowValid = true;

      mappings.forEach(map => {
        const value = row[map.excelColumn];
        const field = schema.fields.find(f => f.name === map.dbField);

        if (field) {
          // Required check
          if (field.required && (value === undefined || value === null || value === '')) {
            errors.push({ row: index + 1, column: map.excelColumn, message: `${field.label} is required`, data: value });
            rowValid = false;
          }

          // Type validation
          if (value !== undefined && value !== null && value !== '') {
            if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
              errors.push({ row: index + 1, column: map.excelColumn, message: 'Invalid email format', data: value });
              rowValid = false;
            }
            if (field.type === 'number' && isNaN(Number(value))) {
              errors.push({ row: index + 1, column: map.excelColumn, message: 'Must be a number', data: value });
              rowValid = false;
            }
            if (field.type === 'date' && isNaN(Date.parse(String(value)))) {
              errors.push({ row: index + 1, column: map.excelColumn, message: 'Invalid date format', data: value });
              rowValid = false;
            }
          }

          mappedRow[map.dbField] = value;
        }
      });

      if (rowValid) {
        validRows.push(mappedRow);
      }
    });

    return { validRows, errors };
  }

  static async batchImport(
    module: ImportModule, 
    data: any[], 
    organizationId: string, 
    userId: string,
    fileName: string
  ) {
    const table = MODULE_SCHEMAS[module].table;
    const batchSize = 100;
    let imported = 0;
    let failed = 0;

    // Create log entry
    const { data: logEntry, error: logError } = await supabase
      .from('import_logs')
      .insert({
        organization_id: organizationId,
        user_id: userId,
        module,
        file_name: fileName,
        rows_total: data.length,
        status: 'processing'
      })
      .select()
      .single();

    if (logError) throw logError;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize).map(row => ({
        ...row,
        organization_id: organizationId,
        // Add other defaults if needed
      }));

      const { error } = await supabase.from(table).insert(batch);

      if (error) {
        failed += batch.length;
        console.error(`Batch import failed for ${table}:`, error);
      } else {
        imported += batch.length;
      }

      // Update progress
      await supabase
        .from('import_logs')
        .update({ 
          rows_imported: imported, 
          rows_failed: failed,
          status: imported + failed === data.length ? 'completed' : 'processing'
        })
        .eq('id', logEntry.id);
    }

    return { imported, failed, logId: logEntry.id };
  }
}
