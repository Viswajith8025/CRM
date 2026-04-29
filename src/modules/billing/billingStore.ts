import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { Invoice, Payment } from './types'

interface BillingState {
  invoices: Invoice[]
  isLoading: boolean
  error: string | null
  fetchInvoices: () => Promise<void>
  addInvoice: (invoice: Partial<Invoice>) => Promise<void>
  updateInvoiceStatus: (id: string, status: Invoice['status']) => Promise<void>
  recordPayment: (payment: Partial<Payment>) => Promise<void>
  getInvoiceById: (id: string) => Promise<Invoice | null>
}

export const useBillingStore = create<BillingState>((set, get) => ({
  invoices: [],
  isLoading: false,
  error: null,

  fetchInvoices: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(name, email, address), project:projects(name)')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      set({ invoices: data as Invoice[], error: null })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  addInvoice: async (invoice) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .insert(invoice)
        .select('*, client:clients(name), project:projects(name)')
        .single()
      
      if (error) throw error
      set({ invoices: [data as Invoice, ...get().invoices] })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  updateInvoiceStatus: async (id, status) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', id)
        .select('*, client:clients(name), project:projects(name)')
        .single()
      
      if (error) throw error
      set({
        invoices: get().invoices.map((inv) => (inv.id === id ? (data as Invoice) : inv))
      })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  recordPayment: async (payment) => {
    try {
      const { error } = await supabase.from('payments').insert(payment)
      if (error) throw error
      
      // Update invoice status to paid automatically if payment matches
      if (payment.invoice_id) {
        await get().updateInvoiceStatus(payment.invoice_id, 'paid')
      }
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  getInvoiceById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(name, email, address), project:projects(name)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Invoice
    } catch (err) {
      return null
    }
  }
}))
