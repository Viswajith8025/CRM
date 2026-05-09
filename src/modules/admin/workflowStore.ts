import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { useProjectsStore } from '@/modules/projects'
import { useBillingStore } from '@/modules/billing'
import { useCRMStore } from '@/modules/crm'
import { toast } from 'sonner'

export type WorkflowTrigger = 
  | 'CLIENT_CREATED' 
  | 'PROPOSAL_APPROVED' 
  | 'PROJECT_COMPLETED' 
  | 'INVOICE_PAID'
  | 'PROJECT_DELAYED'

export interface WorkflowRule {
  id: string
  name: string
  trigger_event: WorkflowTrigger
  action_type: 'CREATE_PROJECT' | 'CREATE_INVOICE' | 'ACTIVATE_CLIENT' | 'NOTIFY_MANAGER'
  configuration: Record<string, any>
  is_active: boolean
}

interface WorkflowState {
  rules: WorkflowRule[]
  isLoading: boolean
  fetchRules: () => Promise<void>
  executeWorkflow: (trigger: WorkflowTrigger, payload: any) => Promise<void>
  logExecution: (ruleId: string | null, entityId: string, status: 'success' | 'failed', error?: string) => Promise<void>
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  rules: [],
  isLoading: false,

  fetchRules: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('workflow_rules')
        .select('*')
        .eq('is_active', true)
      
      if (error) throw error
      set({ rules: data as WorkflowRule[] })
    } catch (err) {
      console.error("Failed to load workflow rules:", err)
    } finally {
      set({ isLoading: false })
    }
  },

  logExecution: async (ruleId, entityId, status, error) => {
    try {
      await supabase.rpc('log_workflow_run', {
        p_rule_id: ruleId,
        p_entity_id: entityId,
        p_status: status,
        p_error: error || null
      })
    } catch (err) {
      console.warn("Workflow logging failed:", err)
    }
  },

  executeWorkflow: async (trigger, payload) => {
    // If rules are not loaded, try to fetch them
    if (get().rules.length === 0) await get().fetchRules()

    const activeRules = get().rules.filter(r => r.trigger_event === trigger)
    if (activeRules.length === 0) {
      console.log(`[Workflow Engine] No active rules for trigger: ${trigger}`)
      return
    }

    console.log(`[Workflow Engine] Executing ${activeRules.length} rules for: ${trigger}`)

    for (const rule of activeRules) {
      const startTime = Date.now()
      try {
        switch (rule.action_type) {
          case 'CREATE_PROJECT':
            await useProjectsStore.getState().addProject({
              name: `Automation: ${payload.name || 'New Project'}`,
              client_id: payload.id,
              status: 'onboarding',
              start_date: new Date().toISOString()
            })
            break

          case 'CREATE_INVOICE':
            const invoiceNumber = `AUTO-${Date.now().toString().slice(-6)}`
            await useBillingStore.getState().addInvoice({
              client_id: payload.client_id || payload.id,
              project_id: payload.project_id || null,
              proposal_id: payload.id,
              amount: payload.amount,
              invoice_number: invoiceNumber,
              due_date: new Date(Date.now() + (rule.configuration.due_days || 7) * 24 * 60 * 60 * 1000).toISOString(),
              status: 'sent'
            })
            break

          case 'ACTIVATE_CLIENT':
            await useCRMStore.getState().updateClient(payload.id, {
              contract_value: payload.amount // Example of activation logic
            })
            break

          case 'NOTIFY_MANAGER':
            // Logic handled by notifications system, but we log it here
            break
            
          default:
            throw new Error(`Action ${rule.action_type} not implemented.`)
        }

        await get().logExecution(rule.id, payload.id, 'success')
        toast.info(`Workflow Completed: ${rule.name}`)
      } catch (err: any) {
        console.error(`[Workflow Engine] Execution failed for rule ${rule.id}:`, err)
        await get().logExecution(rule.id, payload.id, 'failed', err.message)
        toast.error(`Workflow Failed: ${rule.name}. Check logs.`)
      }
    }
  }
}))
