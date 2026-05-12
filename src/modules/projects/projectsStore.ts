import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import { useTasksStore } from '@/modules/tasks'
import { logActivity } from '@/lib/auditLogger'
import { notificationService } from '@/lib/notificationService'
import { fetchPaginatedData, type PaginationParams } from '@/lib/pagination'
import type { Project, Milestone } from './types'

const CACHE_TTL_MS = 5 * 60 * 1000

export interface Sprint {
  id: string
  project_id: string
  name: string
  start_date: string
  end_date: string
  status: 'planned' | 'active' | 'completed'
  created_at: string
}

interface ProjectsState {
  projects: Project[]
  sprints: Record<string, Sprint[]>
  isLoading: boolean
  error: string | null
  hasFetched: boolean
  lastFetchedAt: number | null
  pagination: {
    totalCount: number
    page: number
    limit: number
    totalPages: number
  }
  fetchProjects: (params?: Partial<PaginationParams> & { force?: boolean }) => Promise<void>
  addProject: (project: Partial<Project>, lead_id?: string, member_ids?: string[]) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>, lead_id?: string, member_ids?: string[]) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  getProjectById: (id: string) => Promise<Project | null>
  
  fetchMilestones: (projectId: string) => Promise<Milestone[]>
  addMilestone: (milestone: Partial<Milestone>) => Promise<void>
  updateMilestone: (id: string, updates: Partial<Milestone>) => Promise<void>
  deleteMilestone: (id: string) => Promise<void>

  fetchSprints: (projectId: string) => Promise<void>
  addSprint: (sprint: Partial<Sprint>) => Promise<void>
  updateSprint: (id: string, updates: Partial<Sprint>) => Promise<void>
  
  subscribeToProjects: () => () => void
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  sprints: {},
  isLoading: false,
  error: null,
  hasFetched: false,
  lastFetchedAt: null,
  pagination: {
    totalCount: 0,
    page: 1,
    limit: 20,
    totalPages: 0
  },

  fetchProjects: async (params = {}) => {
    const { force = false, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {} } = params
    
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const baseQuery = supabase
        .from('projects')
        .select(`
          *,
          client:clients(name),
          members:project_members(role, user_id, profiles(full_name, email)),
          milestones:project_milestones(*),
          tasks:tasks(
            status, 
            due_date, 
            assignee:assigned_to(id, full_name, avatar_url),
            time_logs(duration_minutes, user:profiles(hourly_rate))
          ),
          invoices(amount, status),
          expenses:project_expenses(*)
        `, { count: 'exact' })
        .eq('organization_id', orgId)
        .is('deleted_at', null)

      const result = await fetchPaginatedData<any>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      const projectsWithStats = result.data.map(project => {
        // ... (The complex mapping logic remains identical)
        const teamMap = new Map()
        project.tasks?.forEach((t: any) => {
          if (t.assignee) teamMap.set(t.assignee.id, t.assignee)
        })
        
        const leadMember = project.members?.find((m: any) => m.role === 'lead')
        const lead = leadMember ? {
          id: leadMember.user_id,
          full_name: leadMember.profiles?.full_name,
          email: leadMember.profiles?.email
        } : undefined

        const totalTasks = project.tasks?.length || 0
        const completedTasks = project.tasks?.filter((t: any) => t.status === 'done').length || 0
        
        const revenue = project.invoices?.filter((inv: any) => inv.status === 'paid').reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) || 0
        
        let laborCost = 0
        project.tasks?.forEach((task: any) => {
          task.time_logs?.forEach((log: any) => {
            const hours = (log.duration_minutes || 0) / 60
            const rate = log.user?.hourly_rate || 0
            laborCost += hours * rate
          })
        })

        const expenseTotal = project.expenses?.reduce((sum: number, exp: any) => sum + (exp.amount || 0), 0) || 0
        const totalCost = laborCost + expenseTotal
        const profit = revenue - totalCost
        
        const now = new Date()
        const overdueTasks = project.tasks?.filter((t: any) => 
          t.due_date && new Date(t.due_date) < now && t.status !== 'done'
        ).length || 0
        
        const missedMilestones = project.milestones?.filter((m: any) => 
          m.due_date && new Date(m.due_date) < now && !m.is_completed
        ).length || 0

        const totalInvoiced = project.invoices?.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0) || 0
        const budgetBurn = project.budget ? (totalInvoiced / project.budget) * 100 : 0
        
        let healthScore = 100
        healthScore -= (overdueTasks * 10)
        healthScore -= (missedMilestones * 20)
        if (budgetBurn > 100) healthScore -= 30
        if (profit < 0 && revenue > 0) healthScore -= 20
        
        let healthStatus: 'on-track' | 'at-risk' | 'delayed' = 'on-track'
        if (healthScore < 60 || missedMilestones > 0 || overdueTasks > 3) healthStatus = 'delayed'
        else if (healthScore < 90 || overdueTasks > 0 || budgetBurn > 90) healthStatus = 'at-risk'

        return {
          ...project,
          team: Array.from(teamMap.values()),
          lead,
          health: {
            score: Math.max(0, healthScore),
            status: healthStatus,
            overdue_tasks: overdueTasks,
            missed_milestones: missedMilestones,
            budget_burn: Math.round(budgetBurn)
          },
          financials: {
            revenue,
            labor_cost: Math.round(laborCost),
            expense_total: Math.round(expenseTotal),
            profit: Math.round(profit),
            profit_margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0
          },
          task_stats: {
            total: totalTasks,
            completed: completedTasks
          }
        }
      })

      set({ 
        projects: projectsWithStats as Project[], 
        pagination: {
          totalCount: result.totalCount,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages
        },
        error: null, 
        hasFetched: true, 
        lastFetchedAt: Date.now() 
      })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load projects.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addProject: async (project, lead_id, member_ids) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const projectWithOrg = { ...project, organization_id: orgId }
      const { data, error } = await supabase
        .from('projects')
        .insert(projectWithOrg)
        .select()
        .single()

      if (error) throw error
      
      const projectId = data.id
      const memberInserts = []
      
      if (lead_id) {
        memberInserts.push({ project_id: projectId, user_id: lead_id, role: 'lead', organization_id: orgId })
      }
      
      if (member_ids && member_ids.length > 0) {
        member_ids.forEach(id => {
          if (id !== lead_id) {
            memberInserts.push({ project_id: projectId, user_id: id, role: 'member', organization_id: orgId })
          }
        })
      }
      
      if (memberInserts.length > 0) {
        await supabase.from('project_members').insert(memberInserts)
      }

      logActivity({
        action: 'CREATE',
        targetType: 'project',
        targetId: data.id,
        targetName: data.name,
        description: `New project created: ${data.name}`,
        organization_id: orgId
      })

      get().fetchProjects(true)
    } catch (err) {
      throw toFriendlyError(err, "Failed to add project.")
    }
  },

  updateProject: async (id, updates, lead_id, member_ids) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      if (lead_id !== undefined || member_ids !== undefined) {
        await supabase.from('project_members').delete().eq('project_id', id).eq('organization_id', orgId)
        
        const memberInserts = []
        if (lead_id) {
          memberInserts.push({ project_id: id, user_id: lead_id, role: 'lead', organization_id: orgId })
        }
        
        if (member_ids && member_ids.length > 0) {
          member_ids.forEach(userId => {
            if (userId !== lead_id) {
              memberInserts.push({ project_id: id, user_id: userId, role: 'member', organization_id: orgId })
            }
          })
        }
        
        if (memberInserts.length > 0) {
          await supabase.from('project_members').insert(memberInserts)
        }
      }

      logActivity({
        action: 'UPDATE',
        targetType: 'project',
        targetId: data.id,
        targetName: data.name,
        description: `Updated project details`,
        organization_id: orgId
      })

      get().fetchProjects(true)
    } catch (err) {
      throw toFriendlyError(err, "Failed to update project.")
    }
  },

  deleteProject: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      logActivity({
        action: 'DELETE',
        targetType: 'project',
        targetId: id,
        targetName: 'Project',
        description: `Soft deleted project`,
        organization_id: orgId
      })

      get().fetchProjects(true)
    } catch (err) {
      throw toFriendlyError(err, "Failed to delete project.")
    }
  },

  getProjectById: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return null

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(name),
          members:project_members(user_id, role, profiles(full_name, email)),
          milestones:project_milestones(*),
          tasks:tasks(*),
          invoices(amount, status),
          expenses:project_expenses(*)
        `)
        .eq('id', id)
        .single()
      if (error) throw error

      const project = data as Project
      return project
    } catch (err) {
      console.error("Error fetching project:", err)
      return null
    }
  },

  fetchMilestones: async (projectId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return []

      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('due_date', { ascending: true })
      if (error) throw error
      return data as Milestone[]
    } catch (err) {
      return []
    }
  },

  addMilestone: async (milestone) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...milestone, organization_id: orgId }
      const { error } = await supabase.from('project_milestones').insert(payload)
      if (error) throw error
    } catch (err) {
      throw toFriendlyError(err, "Failed to add milestone.")
    }
  },

  updateMilestone: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('project_milestones')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    } catch (err) {
      throw toFriendlyError(err, "Failed to update milestone.")
    }
  },

  deleteMilestone: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('project_milestones')
        .delete()
        .eq('id', id)
      if (error) throw error
    } catch (err) {
      throw toFriendlyError(err, "Failed to delete milestone.")
    }
  },

  subscribeToProjects: () => {
    const channel = supabase
      .channel(`projects_sync_global`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projects' },
        () => {
          get().fetchProjects(true)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  fetchSprints: async (projectId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('project_sprints')
        .select('*')
        .eq('project_id', projectId)
        .eq('organization_id', orgId)
        .order('start_date', { ascending: true })

      if (error) throw error
      set({ 
        sprints: { 
          ...get().sprints, 
          [projectId]: data as Sprint[] 
        } 
      })
    } catch (err) {
      console.error("Error fetching sprints:", err)
    }
  },

  addSprint: async (sprint) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const payload = { ...sprint, organization_id: orgId }
      const { data, error } = await supabase
        .from('project_sprints')
        .insert(payload)
        .select()
        .single()

      if (error) throw error
      
      const projectId = data.project_id
      set({ 
        sprints: { 
          ...get().sprints, 
          [projectId]: [...(get().sprints[projectId] || []), data as Sprint] 
        } 
      })
    } catch (err) {
      throw err
    }
  },

  updateSprint: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('project_sprints')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      
      const projectId = data.project_id
      set({
        sprints: {
          ...get().sprints,
          [projectId]: get().sprints[projectId].map(s => s.id === id ? data as Sprint : s)
        }
      })
    } catch (err) {
      throw err
    }
  }
}))
