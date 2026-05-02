export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string
  user_id: string
  client_id: string
  project_id: string | null
  proposal_id: string | null
  invoice_number: string
  amount: number
  tax_rate: number
  tax_amount: number
  is_recurring: boolean
  frequency: 'monthly' | 'quarterly' | 'yearly' | null
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
  milestone_name: string | null
  transaction_id: string | null
  paid_at: string
}

export interface Subscription {
  id: string
  client_id: string
  service_name: string
  amount: number
  frequency: 'monthly' | 'quarterly' | 'yearly'
  next_billing_date: string
  status: 'active' | 'paused' | 'cancelled'
  created_at: string
}
