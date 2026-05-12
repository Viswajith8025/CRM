import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { format, subDays, isBefore, addDays } from 'date-fns'
import { useNotificationsStore } from '@/modules/notifications'

interface AutomationState {
  isChecking: boolean
  lastCheckedAt: string | null
  runSmartReminders: () => Promise<void>
}

// The zero UUID is the default placeholder — never query with it, it will 400 or return wrong data
const NULL_ORG_ID = '00000000-0000-0000-0000-000000000000'

export const useAutomationStore = create<AutomationState>((set, get) => ({
  isChecking: false,
  lastCheckedAt: null,

  runSmartReminders: async () => {
    // DISABLED TEMPORARILY TO STOP LOOP
    return
    
    // Throttle: don't run more than once every 60 seconds
    if (state.lastCheckedAt) {
      const lastCheck = new Date(state.lastCheckedAt)
      const diff = (new Date().getTime() - lastCheck.getTime()) / 1000
      if (diff < 60) return
    }

    set({ isChecking: true })

    try {
      const { profile, isLoading } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      
      // If still loading profile, don't warn, just skip for this cycle
      if (isLoading || !profile) return

      const orgId = profile.organization_id

      // Super Admins are global and might not be assigned to a specific organization.
      // We skip reminders for them without warning, as they are system-wide maintainers.
      if (profile.role === 'super_admin' && (!orgId || orgId === NULL_ORG_ID)) {
        return
      }

      // Guard: if org_id is missing or the null-placeholder UUID, skip all queries.
      // This happens when JWT claims haven't been synced — user should sign out and back in.
      if (!orgId || orgId === NULL_ORG_ID) {
        return
      }

      const { addNotification } = useNotificationsStore.getState()
      const now = new Date()
      const sevenDaysAgo = subDays(now, 7)
      const tomorrow = addDays(now, 1)
      const tomorrowStr = format(tomorrow, 'yyyy-MM-dd')

      // 1. Check Overdue Invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount')
        .eq('organization_id', orgId)
        .eq('status', 'sent')
        .lt('due_date', format(now, 'yyyy-MM-dd'))

      invoices?.forEach(inv => {
        addNotification({
          title: 'Overdue Invoice',
          message: `Invoice ${inv.invoice_number} for ₹${inv.amount} is overdue.`,
          type: 'error',
          link: `/billing/${inv.id}`
        })
      })

      // 2. Check Inactive Leads (No contact activity in 7+ days)
      // Using .neq() instead of .not('status', 'eq', ...) — cleaner PostgREST syntax
      const { data: inactiveLeads } = await supabase
        .from('leads')
        .select('id, first_name, last_name, last_contacted_at, created_at')
        .eq('organization_id', orgId)
        .neq('status', 'converted')

      inactiveLeads?.forEach(lead => {
        const lastActivity = lead.last_contacted_at || lead.created_at
        if (!lastActivity || isBefore(new Date(lastActivity), sevenDaysAgo)) {
          addNotification({
            title: 'Stale Lead',
            message: `Lead ${lead.first_name} ${lead.last_name || ''} has had no activity for 7 days.`,
            type: 'warning',
            link: `/crm`
          })
        }
      })

      // 3. Check Milestones Due Tomorrow
      // IMPORTANT: project_milestones does NOT have an organization_id column.
      // It is scoped to projects via project_id. RLS on projects handles data isolation.
      // Do NOT filter by organization_id here — it will cause a 400 Bad Request.
      const { data: milestones } = await supabase
        .from('project_milestones')
        .select('id, title, project_id, due_date, project:projects(name)')
        .eq('status', 'pending')
        .gte('due_date', tomorrowStr)
        .lte('due_date', tomorrowStr)

      milestones?.forEach(m => {
        const projectName = (m.project as any)?.name ?? 'Unknown Project'
        addNotification({
          title: 'Milestone Due Tomorrow',
          message: `Milestone "${m.title}" for project "${projectName}" is due tomorrow.`,
          type: 'info',
          link: `/projects/${m.project_id}`
        })
      })

      set({ lastCheckedAt: new Date().toISOString() })
    } catch (err) {
      console.error('Smart Reminders Engine Error:', err)
    } finally {
      set({ isChecking: false })
    }
  }
}))

