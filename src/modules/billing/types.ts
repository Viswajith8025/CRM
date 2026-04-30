export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string
  user_id: string
  client_id: string
  project_id: string | null
  invoice_number: string
  amount: number
  status: InvoiceStatus
  due_date: string
  issued_at: string
  created_at: string
  updated_at: string
  client?: { name: string, email: string, address: string }
  project?: { name: string }
}

export interface Payment {
  id: string
  user_id: string
  invoice_id: string
  amount: number
  payment_method: string
  transaction_id: string | null
  paid_at: string
}
