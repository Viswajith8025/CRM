import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type WidgetId = 'revenue_summary' | 'recent_tasks' | 'active_projects' | 'lead_funnel' | 'team_productivity' | 'recent_activity' | 'critical_deadlines' | 'cash_flow'

export interface WidgetConfig {
  id: WidgetId
  title: string
  description?: string
  requiredPermission?: string
  defaultSize: 'small' | 'medium' | 'large'
}

export const WIDGET_REGISTRY: Record<WidgetId, WidgetConfig> = {
  revenue_summary: {
    id: 'revenue_summary',
    title: 'Financial Overview',
    description: 'Monthly revenue and pending payments.',
    requiredPermission: 'billing.payments.record',
    defaultSize: 'medium'
  },
  recent_tasks: {
    id: 'recent_tasks',
    title: 'My Tasks',
    description: 'Quick view of your upcoming deadlines.',
    defaultSize: 'small'
  },
  active_projects: {
    id: 'active_projects',
    title: 'Active Projects',
    description: 'Status summary of running projects.',
    defaultSize: 'medium'
  },
  lead_funnel: {
    id: 'lead_funnel',
    title: 'Sales Pipeline',
    description: 'Lead conversion tracking.',
    requiredPermission: 'crm.leads.create',
    defaultSize: 'medium'
  },
  team_productivity: {
    id: 'team_productivity',
    title: 'Team Matrix',
    description: 'Resource utilization and hours logged.',
    requiredPermission: 'admin.team.manage',
    defaultSize: 'large'
  },
  recent_activity: {
    id: 'recent_activity',
    title: 'Workspace Audit',
    description: 'Real-time activity stream.',
    defaultSize: 'medium'
  },
  critical_deadlines: {
    id: 'critical_deadlines',
    title: 'Critical Deadlines',
    description: 'Tasks needing immediate attention.',
    defaultSize: 'medium'
  },
  cash_flow: {
    id: 'cash_flow',
    title: 'Cash Flow Health',
    description: 'Balance between paid and outstanding.',
    requiredPermission: 'billing.payments.record',
    defaultSize: 'medium'
  }
}

interface DashboardState {
  layout: WidgetId[]
  setLayout: (newLayout: WidgetId[]) => void
  resetLayout: () => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      layout: ['revenue_summary', 'recent_activity', 'active_projects', 'recent_tasks', 'critical_deadlines', 'cash_flow'],
      setLayout: (newLayout) => set({ layout: newLayout }),
      resetLayout: () => set({ layout: ['revenue_summary', 'recent_activity', 'active_projects', 'recent_tasks', 'critical_deadlines', 'cash_flow'] })
    }),
    {
      name: 'dashboard-layout-storage'
    }
  )
)
