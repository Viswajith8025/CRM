import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import { useActivityStore } from '@/modules/reports/activityStore'
import type { Invoice, Payment } from './types'

interface BillingState {
  invoices: Invoice[]
  isLoading: boolean
  error: string | null
  hasFetched: boolean
  fetchInvoices: (force?: boolean) => Promise<void>
  addInvoice: (invoice: Partial<Invoice>) => Promise<void>
  updateInvoiceStatus: (id: string, status: Invoice['status']) => Promise<void>
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  recordPayment: (payment: Partial<Payment>) => Promise<void>
  getInvoiceById: (id: string) => Promise<Invoice | null>
}

export const useBillingStore = create<BillingState>((set, get) => ({
  invoices: [],
  isLoading: false,
  error: null,
  hasFetched: false,

  fetchInvoices: async (force = false) => {
    if (!force && get().hasFetched) return;
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(name, email, address), project:projects(name)')
        .order('created_at', { ascending: false })

      if (error) throw error
      set({ invoices: data as Invoice[], error: null, hasFetched: true })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load invoices.") })
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
      
      // Log Activity
      useActivityStore.getState().logActivity({
        action: 'issued invoice',
        target_type: 'invoice',
        target_name: data.invoice_number,
        target_id: data.id
      })

      set({ invoices: [data as Invoice, ...get().invoices] })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to add invoice.")
      set({ error: friendlyError.message })
      throw friendlyError
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
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to update invoice status.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  updateInvoice: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id)
        .select('*, client:clients(name), project:projects(name)')
        .single()

      if (error) throw error
      set({
        invoices: get().invoices.map((inv) => (inv.id === id ? (data as Invoice) : inv))
      })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to update invoice.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  deleteInvoice: async (id) => {
    const previousInvoices = get().invoices
    // Optimistic UI update
    set({ invoices: previousInvoices.filter(i => i.id !== id) })

    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id)
      if (error) throw error
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to delete invoice.")
      // Rollback
      set({ invoices: previousInvoices, error: friendlyError.message })
      throw friendlyError
    }
  },

  recordPayment: async (payment) => {
    try {
      const { error } = await supabase.from('payments').insert(payment)
      if (error) throw error

      // Update invoice status to paid automatically if payment matches
      if (payment.invoice_id) {
        await get().updateInvoiceStatus(payment.invoice_id, 'paid')
        
        // Log Activity
        useActivityStore.getState().logActivity({
          action: 'recorded payment',
          target_type: 'billing',
          target_name: `Payment of $${payment.amount}`,
          target_id: payment.invoice_id
        })
      }
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to record payment.")
      set({ error: friendlyError.message })
      throw friendlyError
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
