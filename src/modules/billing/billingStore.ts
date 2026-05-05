import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import { logActivity } from '@/lib/auditLogger'
import { notificationService } from '@/lib/notificationService'
import type { Invoice, Payment } from './types'

interface BillingState {
  invoices: Invoice[]
  payments: Payment[]
  isLoading: boolean
  error: string | null
  hasFetched: boolean
  lastFetchedAt: number | null
  
  fetchInvoices: (force?: boolean) => Promise<void>
  fetchPayments: (force?: boolean) => Promise<void>
  addInvoice: (invoice: Partial<Invoice>) => Promise<void>
  updateInvoiceStatus: (id: string, status: Invoice['status']) => Promise<void>
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  recordPayment: (payment: Partial<Payment>) => Promise<void>
  getInvoiceById: (id: string) => Promise<Invoice | null>
  
  // New CEO Features
  fetchSubscriptions: () => Promise<void>
  addSubscription: (subscription: any) => Promise<void>
  convertProposalToInvoice: (proposalId: string) => Promise<void>
}

export const useBillingStore = create<BillingState>((set, get) => ({
  invoices: [],
  payments: [],
  isLoading: false,
  error: null,
  hasFetched: false,
  lastFetchedAt: null,

  fetchPayments: async (force = false) => {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .order('paid_at', { ascending: false })
        .range(0, 100)

      if (error) throw error
      set({ payments: data as Payment[] })
    } catch (err) {
      console.error("Failed to load payments:", err)
    }
  },

  fetchInvoices: async (force = false) => {
    const isFresh = false // Force fresh fetch
    if (!force && get().hasFetched && isFresh) return
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(name, email, address), project:projects(name)')
        .order('created_at', { ascending: false })
        .range(0, 50)

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
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const invoiceWithOrg = { ...invoice, organization_id: profile?.organization_id }

      const { data, error } = await supabase
        .from('invoices')
        .insert(invoiceWithOrg)
        .select('*, client:clients(name), project:projects(name)')
        .single()

      if (error) throw error
      
      // Audit Log
      logActivity({
        action: 'CREATE',
        targetType: 'invoice',
        targetId: data.id,
        targetName: data.invoice_number,
        description: `Issued new invoice for $${data.amount.toLocaleString()}`
      })

      // Trigger Notification
      notificationService.notifyInvoiceCreated(data.id, data.invoice_number, data.amount)

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

      // Audit Log
      logActivity({
        action: 'STATUS_CHANGE',
        targetType: 'invoice',
        targetId: id,
        targetName: data.invoice_number,
        description: `Invoice status changed to ${status}`
      })

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
      const { error } = await supabase
        .from('invoices')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      logActivity({
        action: 'DELETE',
        targetType: 'invoice',
        targetId: id,
        targetName: 'Invoice',
        description: `Soft deleted invoice`
      })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to delete invoice.")
      // Rollback
      set({ invoices: previousInvoices, error: friendlyError.message })
      throw friendlyError
    }
  },

  restoreInvoice: async (id) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ deleted_at: null })
        .eq('id', id)

      if (error) throw error

      get().fetchInvoices(true)

      logActivity({
        action: 'UPDATE',
        targetType: 'invoice',
        targetId: id,
        targetName: 'Restored Invoice',
        description: `Restored a previously deleted invoice`
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to restore invoice.")
    }
  },

  recordPayment: async (payment) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const paymentWithOrg = { ...payment, organization_id: profile?.organization_id }
      
      const { error } = await supabase.from('payments').insert(paymentWithOrg)
      if (error) throw error

      // Update invoice status to paid automatically if payment matches
      if (payment.invoice_id) {
        await get().updateInvoiceStatus(payment.invoice_id, 'paid')
        
        // Audit Log
        logActivity({
          action: 'PAYMENT',
          targetType: 'invoice',
          targetId: payment.invoice_id,
          targetName: `Payment Recieved`,
          description: `Recorded payment of $${payment.amount}`
        })

        // Refresh state
        get().fetchInvoices(true)
        get().fetchPayments(true)
      }

        // Trigger Notification
        notificationService.notifyPaymentReceived(payment.invoice_id, payment.amount!)
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
  },

  fetchSubscriptions: async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, client:clients(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      // Use state if needed or just return
    } catch (err) {
      console.error("Error fetching subscriptions:", err)
    }
  },

  addSubscription: async (subscription) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const payload = { ...subscription, organization_id: profile?.organization_id }
      const { error } = await supabase.from('subscriptions').insert(payload)
      if (error) throw error
    } catch (err) {
      console.error("Error adding subscription:", err)
      throw err
    }
  },

  convertProposalToInvoice: async (proposalId) => {
    try {
      // 1. Fetch proposal
      const { data: proposal, error: pError } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single()
      
      if (pError) throw pError

      // 2. Create invoice
      const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const secureId = crypto.randomUUID().split('-')[0].toUpperCase()
      const invoiceNumber = `INV-${datePrefix}-${secureId}`
      const newInvoice: Partial<Invoice> = {
        client_id: proposal.client_id || (await get().fetchClientByLead(proposal.lead_id)),
        proposal_id: proposal.id,
        amount: proposal.amount,
        status: 'sent',
        invoice_number: invoiceNumber,
        issued_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
      }

      await get().addInvoice(newInvoice)
      
      // 3. Update proposal status
      const { useCRMStore } = await import('@/modules/crm/store/crmStore')
      await useCRMStore.getState().updateProposal(proposalId, { status: 'accepted' })
      
      return true
    } catch (err) {
      console.error("Error converting proposal:", err)
      throw err
    }
  },

  fetchClientByLead: async (leadId) => {
    // Helper to find client by lead
    const { data } = await supabase.from('clients').select('id').eq('lead_id', leadId).single()
    return data?.id
  }
}))
