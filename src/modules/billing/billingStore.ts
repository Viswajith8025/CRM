import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import { logActivity } from '@/lib/auditLogger'
import { notificationService } from '@/lib/notificationService'
import { fetchPaginatedData, type PaginationParams } from '@/lib/pagination'
import type { Invoice, Payment } from './types'

interface BillingState {
  invoices: Invoice[]
  payments: Payment[]
  isLoading: boolean
  error: string | null
  hasFetched: boolean
  lastFetchedAt: number | null
  pagination: {
    invoices: { totalCount: number, page: number, limit: number, totalPages: number }
    payments: { totalCount: number, page: number, limit: number, totalPages: number }
  }
  
  fetchInvoices: (params?: Partial<PaginationParams> & { force?: boolean }) => Promise<void>
  fetchPayments: (params?: Partial<PaginationParams> & { force?: boolean }) => Promise<void>
  addInvoice: (invoice: Partial<Invoice>) => Promise<void>
  updateInvoiceStatus: (id: string, status: Invoice['status']) => Promise<void>
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>
  deleteInvoice: (id: string) => Promise<void>
  signInvoice: (id: string, signatureData: { name: string, signature: string }) => Promise<void>
  recordPayment: (payment: Partial<Payment>) => Promise<void>
  getInvoiceById: (id: string) => Promise<Invoice | null>
  verifyPayment: (paymentId: string) => Promise<void>
  fetchInvoiceRevisions: (invoiceId: string) => Promise<any[]>
  
  fetchSubscriptions: () => Promise<void>
  addSubscription: (subscription: any) => Promise<void>
  convertProposalToInvoice: (proposalId: string) => Promise<void>
  fetchClientByLead: (leadId: string) => Promise<string | undefined>
}

export const useBillingStore = create<BillingState>((set, get) => ({
  invoices: [],
  payments: [],
  isLoading: false,
  error: null,
  hasFetched: false,
  lastFetchedAt: null,
  pagination: {
    invoices: { totalCount: 0, page: 1, limit: 20, totalPages: 0 },
    payments: { totalCount: 0, page: 1, limit: 20, totalPages: 0 }
  },

  fetchPayments: async (params = {}) => {
    const { page = 1, limit = 20, sortBy = 'paid_at', sortOrder = 'desc', filters = {} } = params
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const baseQuery = supabase
        .from('payments')
        .select('*', { count: 'exact' })
        .eq('organization_id', orgId)

      const result = await fetchPaginatedData<Payment>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      set(state => ({ 
        payments: result.data,
        pagination: {
          ...state.pagination,
          payments: {
            totalCount: result.totalCount,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
          }
        }
      }))
    } catch (err) {
      console.error("Failed to load payments:", err)
    }
  },

  fetchInvoices: async (params = {}) => {
    const { force = false, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} } = params
    if (!force && get().hasFetched && page === get().pagination.invoices.page) return
    
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const baseQuery = supabase
        .from('invoices')
        .select('*, client:clients(name, email, address), project:projects(name)', { count: 'exact' })
        .eq('organization_id', orgId)

      const result = await fetchPaginatedData<Invoice>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      set(state => ({ 
        invoices: result.data, 
        pagination: {
          ...state.pagination,
          invoices: {
            totalCount: result.totalCount,
            page: result.page,
            limit: result.limit,
            totalPages: result.totalPages
          }
        },
        error: null, 
        hasFetched: true, 
        lastFetchedAt: Date.now() 
      }))
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load invoices.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addInvoice: async (invoice) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")
      
      const invoiceWithOrg = { ...invoice, organization_id: orgId, user_id: profile?.id }

      const { data, error } = await supabase
        .from('invoices')
        .insert(invoiceWithOrg)
        .select('*, client:clients(name), project:projects(name)')
        .single()

      if (error) throw error
      
      if (data.status === 'paid') {
        await supabase.from('payments').insert({
          user_id: profile?.id,
          organization_id: orgId,
          invoice_id: data.id,
          amount: data.amount,
          payment_method: 'manual',
          paid_at: new Date().toISOString()
        })
        get().fetchPayments(true)
      }

      logActivity({
        action: 'CREATE',
        targetType: 'invoice',
        targetId: data.id,
        targetName: data.invoice_number,
        description: `Issued new invoice for $${data.amount.toLocaleString()} (${data.status})`,
        organization_id: orgId
      })

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
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', id)
        .eq('organization_id', orgId)
        .select('*, client:clients(name), project:projects(name)')
        .single()

      if (error) throw error

      if (status === 'paid') {
        const { data: existingPayments } = await supabase
          .from('payments')
          .select('id')
          .eq('invoice_id', id)
          .eq('organization_id', orgId)
          .limit(1)

        if (!existingPayments || existingPayments.length === 0) {
          await supabase.from('payments').insert({
            user_id: profile?.id,
            organization_id: orgId,
            invoice_id: id,
            amount: data.amount,
            payment_method: 'manual',
            paid_at: new Date().toISOString()
          })
          get().fetchPayments(true)
        }
      }

      logActivity({
        action: 'STATUS_CHANGE',
        targetType: 'invoice',
        targetId: id,
        targetName: data.invoice_number,
        description: `Invoice status changed to ${status}`,
        organization_id: orgId
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
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', id)
        .eq('organization_id', orgId)
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
    set({ invoices: previousInvoices.filter(i => i.id !== id) })

    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('invoices')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error

      logActivity({
        action: 'DELETE',
        targetType: 'invoice',
        targetId: id,
        targetName: 'Invoice',
        description: `Soft deleted invoice`,
        organization_id: orgId
      })
    } catch (err) {
      set({ invoices: previousInvoices, error: toFriendlyError(err, "Failed to delete invoice.").message })
    }
  },

  signInvoice: async (id, signatureData) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('invoices')
        .update({
          signature_data: signatureData.signature,
          signer_name: signatureData.name,
          signed_at: new Date().toISOString(),
          status: 'paid'
        })
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) throw error
      
      set(state => ({
        invoices: state.invoices.map(inv => 
          inv.id === id ? { ...inv, status: 'paid', signer_name: signatureData.name } : inv
        )
      }))
    } catch (err) {
      console.error("Failed to sign invoice:", err)
      throw err
    }
  },

  recordPayment: async (payment) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const paymentWithOrg = { ...payment, organization_id: orgId, user_id: profile?.id, status: 'pending' }
      
      const { error } = await supabase.from('payments').insert(paymentWithOrg)
      if (error) throw error

      logActivity({
        action: 'PAYMENT_STATUS_CHANGE',
        targetType: 'payment',
        targetId: payment.invoice_id || 'manual',
        targetName: payment.transaction_id || 'Manual Payment',
        description: `Payment of $${payment.amount} recorded (Pending Verification)`,
        organization_id: orgId
      })

      get().fetchPayments(true)
      get().fetchInvoices(true) // Refresh invoices as triggers might have updated paid_amount
    } catch (err) {
      throw toFriendlyError(err, "Failed to record payment.")
    }
  },

  verifyPayment: async (paymentId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('payments')
        .update({ 
          status: 'verified', 
          verified_at: new Date().toISOString(),
          verified_by: profile.id
        })
        .eq('id', paymentId)
        .eq('organization_id', orgId)

      if (error) throw error

      get().fetchPayments(true)
      get().fetchInvoices(true)
    } catch (err) {
      throw toFriendlyError(err, "Failed to verify payment.")
    }
  },

  fetchInvoiceRevisions: async (invoiceId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return []

      const { data, error } = await supabase
        .from('invoice_revisions')
        .select('*, profiles:created_by(full_name)')
        .eq('invoice_id', invoiceId)
        .eq('organization_id', orgId)
        .order('version', { ascending: false })

      if (error) throw error
      return data
    } catch (err) {
      console.error("Failed to fetch invoice revisions:", err)
      return []
    }
  },

  getInvoiceById: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return null

      const { data, error } = await supabase
        .from('invoices')
        .select('*, client:clients(name, email, address), project:projects(name)')
        .eq('id', id)
        .eq('organization_id', orgId)
        .single()
      if (error) throw error
      return data as Invoice
    } catch (err) {
      return null
    }
  },

  fetchSubscriptions: async () => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('subscriptions')
        .select('*, client:clients(name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
      if (error) throw error
    } catch (err) {
      console.error("Error fetching subscriptions:", err)
    }
  },

  addSubscription: async (subscription) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...subscription, organization_id: orgId, user_id: profile?.id }
      const { error } = await supabase.from('subscriptions').insert(payload)
      if (error) throw error
    } catch (err) {
      console.error("Error adding subscription:", err)
      throw err
    }
  },

  convertProposalToInvoice: async (proposalId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data: proposal, error: pError } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .eq('organization_id', orgId)
        .single()
      
      if (pError) throw pError

      const datePrefix = new Date().toISOString().split('T')[0].replace(/-/g, '')
      const secureId = crypto.randomUUID().split('-')[0].toUpperCase()
      const invoiceNumber = `INV-${datePrefix}-${secureId}`
      
      const clientId = proposal.client_id || (await get().fetchClientByLead(proposal.lead_id))
      
      const newInvoice: Partial<Invoice> = {
        client_id: clientId,
        proposal_id: proposal.id,
        amount: proposal.amount,
        status: 'sent',
        invoice_number: invoiceNumber,
        issued_at: new Date().toISOString(),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }

      await get().addInvoice(newInvoice)
      
      const { useCRMStore } = await import('@/modules/crm')
      await useCRMStore.getState().updateProposal(proposalId, { status: 'accepted' })
      
      return true
    } catch (err) {
      console.error("Error converting proposal:", err)
      throw err
    }
  },

  fetchClientByLead: async (leadId) => {
    const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
    const { data } = await supabase
      .from('clients')
      .select('id')
      .eq('lead_id', leadId)
      .eq('organization_id', profile?.organization_id)
      .single()
    return data?.id
  }
}))
