import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import { useTasksStore } from '@/modules/tasks'
import { logActivity } from '@/lib/auditLogger'
import { notificationService } from '@/lib/notificationService'
import { fetchPaginatedData, type PaginationParams } from '@/lib/pagination'
import type { Project, Milestone } from './types'
import { parseProjectMetadata, serializeProjectMetadata, parseModuleMetadata, serializeModuleMetadata } from '@/lib/metadataFallback'

const CACHE_TTL_MS = 5 * 60 * 1000

export interface ProjectModule {
  id: string
  project_id: string
  organization_id: string
  parent_id: string | null
  name: string
  description: string | null
  color: string
  sort_order: number
  created_by: string | null
  created_at: string
  updated_at: string
  submodules?: ProjectModule[]
}

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
  archivedProjects: Project[]
  sprints: Record<string, Sprint[]>
  modules: Record<string, ProjectModule[]>
  isLoading: boolean
  isArchivedLoading: boolean
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
  fetchArchivedProjects: () => Promise<void>
  unarchiveProject: (id: string) => Promise<void>
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

  fetchModules: (projectId: string) => Promise<void>
  addModule: (module: Partial<ProjectModule>) => Promise<ProjectModule>
  updateModule: (id: string, updates: Partial<ProjectModule>) => Promise<void>
  deleteModule: (id: string) => Promise<void>
  
  archiveProject: (id: string) => Promise<void>
  subscribeToProjects: () => () => void
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  archivedProjects: [],
  sprints: {},
  modules: {},
  isLoading: false,
  isArchivedLoading: false,
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
    const { force = false, page = 1, limit = 20, sortBy = 'created_at', sortOrder = 'desc', filters = {}, includeArchived = false } = params
    
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { useRBACStore } = await import('@/modules/admin/rbacStore')
      const canManageProjects = useRBACStore.getState().hasPermission('projects.manage')

      let userDeptId: string | null = null
      let explicitProjectIds = new Set<string>()
      
      if (!canManageProjects) {
        const { data: deptData } = await supabase
          .from('department_members')
          .select('department_id')
          .eq('profile_id', profile.id)
          .limit(1)
        if (deptData && deptData.length > 0) {
          userDeptId = deptData[0].department_id
        }

        // Fetch projects where user has a task
        const { data: userTasks } = await supabase
          .from('tasks')
          .select('project_id')
          .eq('assigned_to', profile.id)
          .not('project_id', 'is', null)
          
        userTasks?.forEach(t => t.project_id && explicitProjectIds.add(t.project_id))

        // Fetch projects where user is explicitly a member (e.g. Team Lead)
        const { data: userMemberships } = await supabase
          .from('project_members')
          .select('project_id')
          .eq('user_id', profile.id)
          
        userMemberships?.forEach(m => m.project_id && explicitProjectIds.add(m.project_id))
      }

      let baseQuery = supabase
        .from('projects')
        .select(`
          *,
          client:clients(name),
          members:project_members(role, user_id, profiles(full_name, email, avatar_url))
        `, { count: 'exact' })
        .eq('organization_id', orgId)

      // Always exclude soft-deleted projects
      baseQuery = baseQuery.is('deleted_at', null)

      if (!includeArchived) {
        baseQuery = baseQuery.or('is_archived.is.null,is_archived.eq.false')
      }

      // Enforce access scoping for employees at the query level
      if (!canManageProjects) {
        let orStrings = []
        if (userDeptId) {
          orStrings.push(`department_id.eq.${userDeptId}`)
        }
        if (explicitProjectIds.size > 0) {
          orStrings.push(`id.in.(${Array.from(explicitProjectIds).join(',')})`)
        }
        
        if (orStrings.length > 0) {
          baseQuery = baseQuery.or(orStrings.join(','))
        } else {
          // If no department and no assigned tasks/memberships, return nothing
          baseQuery = baseQuery.eq('id', '00000000-0000-0000-0000-000000000000')
        }
      }

      const result = await fetchPaginatedData<any>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
        filters
      })

      // Aggregate health stats dynamically from tasks table to avoid 404 on missing view
      const projectIds = result.data.map(p => p.id)
      let statsMap = new Map()
      
      if (projectIds.length > 0) {
        const { data: rawTasks } = await supabase
          .from('tasks')
          .select('project_id, status, due_date')
          .in('project_id', projectIds)
          .is('deleted_at', null)
        
        if (rawTasks) {
          const today = new Date()
          rawTasks.forEach(t => {
            const st = statsMap.get(t.project_id) || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0, missed_milestones: 0, revenue: 0, labor_cost: 0, expense_total: 0, profit: 0, budget_burn: 0 }
            st.total_tasks++
            if (t.status === 'done' || t.status === 'completed') {
              st.completed_tasks++
            } else if (t.due_date && new Date(t.due_date) < today) {
              st.overdue_tasks++
            }
            statsMap.set(t.project_id, st)
          })
        }
      }

      const projectsWithStats = result.data.map(project => {
        // Derive team strictly from project_members, avoiding task iteration
        const teamMap = new Map()
        project.members?.forEach((m: any) => {
          if (m.profiles) {
            teamMap.set(m.user_id, { 
              id: m.user_id, 
              full_name: m.profiles.full_name, 
              avatar_url: m.profiles.avatar_url 
            })
          }
        })
        
        const leadMember = project.members?.find((m: any) => m.role === 'lead')
        const lead = leadMember ? {
          id: leadMember.user_id,
          full_name: leadMember.profiles?.full_name,
          email: leadMember.profiles?.email,
          avatar_url: leadMember.profiles?.avatar_url
        } : undefined

        const stats = statsMap.get(project.id) || {}
        
        const totalTasks = stats.total_tasks || 0
        const completedTasks = stats.completed_tasks || 0
        const overdueTasks = stats.overdue_tasks || 0
        const missedMilestones = stats.missed_milestones || 0
        
        const revenue = stats.revenue || 0
        const laborCost = stats.labor_cost || 0
        const expenseTotal = stats.expense_total || 0
        const profit = stats.profit || 0
        const budgetBurn = stats.budget_burn || 0
        
        // Health Calculation Logic
        let healthStatus: 'on-track' | 'at-risk' | 'delayed' = 'on-track'
        let healthScore = 100

        // 1. If project is not active, health is neutral/on-track
        const isInactive = ['completed', 'cancelled', 'on_hold'].includes(project.status)
        
        if (isInactive) {
          healthStatus = 'on-track'
        } else {
          healthScore -= (overdueTasks * 10)
          healthScore -= (missedMilestones * 20)
          if (budgetBurn > 100) healthScore -= 30
          if (profit < 0 && revenue > 0) healthScore -= 20

          // 2. Thresholds
          if (healthScore < 60 || missedMilestones > 0 || overdueTasks > 3) {
            healthStatus = 'delayed'
          } else if (healthScore < 90 || overdueTasks > 0 || budgetBurn > 90) {
            healthStatus = 'at-risk'
          }
        }

        const metadata = parseProjectMetadata(project)
        return {
          ...project,
          department_id: metadata.department_id,
          description: metadata.cleanDescription,
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
        isLoading: false,
        hasFetched: true, 
        lastFetchedAt: Date.now() 
      })
    } catch (err: any) {
      set({ error: err.message, isLoading: false })
    }
  },

  fetchArchivedProjects: async () => {
    set({ isArchivedLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(name)
        `)
        .eq('organization_id', orgId)
        .eq('is_archived', true)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })

      if (error) throw error
      
      const parsedData = (data || []).map(p => ({
        ...p,
        metadata: parseProjectMetadata(p.metadata)
      }))
      
      set({ archivedProjects: parsedData, isArchivedLoading: false })
    } catch (err: any) {
      set({ error: err.message, isArchivedLoading: false })
    }
  },

  unarchiveProject: async (id) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ is_archived: false, status: 'in_progress' })
        .eq('id', id)

      if (error) throw error

      get().fetchProjects({ force: true })
      get().fetchArchivedProjects()
    } catch (err: any) {
      throw new Error(err.message)
    }
  },

  addProject: async (project, lead_id, member_ids) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { department_id, ...dbProject } = project as any
      const processedProject = serializeProjectMetadata(dbProject, department_id || null)
      const projectWithOrg = { ...processedProject, organization_id: orgId }
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

      const currentProject = get().projects.find(p => p.id === id)
      const { department_id, ...cleanUpdates } = updates as any

      const fullProject = {
        ...(currentProject || {}),
        ...cleanUpdates
      }

      const processedProject = serializeProjectMetadata(
        fullProject,
        department_id !== undefined ? department_id : (currentProject as any)?.department_id
      )

      const finalUpdates = {
        ...cleanUpdates,
        description: processedProject.description,
        ...( ('department_id' in processedProject) ? { department_id: processedProject.department_id } : {} )
      }

      let query = supabase
        .from('projects')
        .update(finalUpdates)
        .eq('id', id)
        .eq('organization_id', orgId)

      if (currentProject?.updated_at) {
        query = query.eq('updated_at', currentProject.updated_at)
      }

      const { data, error } = await query.select().single()

      if (error) {
        if (error.code === 'PGRST116') {
           throw new Error("Conflict: This project was modified by another user. Please refresh and try again.")
        }
        throw error
      }

      if (lead_id !== undefined || member_ids !== undefined) {
        const rpcError = await supabase.rpc('update_project_members', {
          p_project_id: id,
          p_org_id: orgId,
          p_lead_id: lead_id || null,
          p_member_ids: member_ids || []
        });

        if (rpcError.error) {
           console.error("Failed to update project members atomically", rpcError.error);
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

      get().fetchProjects({ force: true })
    } catch (err) {
      throw toFriendlyError(err, "Failed to update project.")
    }
  },

  deleteProject: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      // Protect against deleting projects with paid financial dependencies
      const { data: dependencies, error: depError } = await supabase
        .from('invoices')
        .select('id')
        .eq('project_id', id)
        .eq('status', 'paid')
        .limit(1)

      if (depError) console.warn('Invoice check failed (non-fatal):', depError.message)

      if (dependencies && dependencies.length > 0) {
        throw new Error("Cannot delete project with paid invoices. Please archive it instead.")
      }

      // Soft delete — DB trigger explicitly prohibits hard DELETE on projects
      // to preserve financial and audit history. Just stamp deleted_at + deleted_by.
      // We do NOT hard delete child records (tasks, members, milestones) so they can be restored later.
      console.log('[Delete Project] Executing soft delete UPDATE for project:', id)
      const { error } = await supabase
        .from('projects')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: profile?.id ?? null,
        })
        .eq('id', id)
        .eq('organization_id', orgId)

      if (error) {
        console.error('[Delete Project] Supabase error:', {
          message: error.message, code: error.code, details: error.details,
        })
        throw error
      }

      logActivity({
        action: 'DELETE',
        targetType: 'project',
        targetId: id,
        targetName: 'Project',
        description: `Permanently deleted project`,
        organization_id: orgId
      })

      get().fetchProjects({ force: true })
    } catch (err: any) {
      const rawError = err?.message || err?.details || "Failed to delete project."
      throw new Error(rawError)
    }
  },

  archiveProject: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      const { error } = await supabase
        .from('projects')
        .update({ is_archived: true })
        .eq('id', id)

      if (error) throw error

      logActivity({
        action: 'UPDATE',
        targetType: 'project',
        targetId: id,
        targetName: 'Project',
        description: `Archived project`,
        organization_id: orgId
      })

      get().fetchProjects({ force: true })
    } catch (err) {
      throw toFriendlyError(err, "Failed to archive project.")
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
          invoices(grand_total, status),
          expenses:project_expenses(*)
        `)
        .eq('id', id)
        .single()
      if (error) throw error

      const project = data as Project
      const metadata = parseProjectMetadata(project)
      return {
        ...project,
        department_id: metadata.department_id,
        description: metadata.cleanDescription,
      } as any
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
    let channel: any = null;
    let isUnsubscribed = false;
    import('@/store/useAuthStore').then(({ useAuthStore }) => {
      if (isUnsubscribed) return;
      const orgId = useAuthStore.getState().profile?.organization_id
      if (!orgId) return
      
      channel = supabase
        .channel(`projects_sync_${orgId}_${Math.random()}`)
        .on(
          'postgres_changes',
          { 
            event: '*', 
            schema: 'public', 
            table: 'projects',
            filter: `organization_id=eq.${orgId}`
          },
          () => get().fetchProjects({ force: true })
        )
        .subscribe()
    })

    return () => {
      isUnsubscribed = true;
      if (channel) supabase.removeChannel(channel)
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
  },

  fetchModules: async (projectId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('project_modules')
        .select('*')
        .eq('project_id', projectId)
        .eq('organization_id', orgId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error

      // Build tree: separate top-level modules and sub-modules
      const all = ((data || []) as any[]).map(m => {
        const metadata = parseModuleMetadata(m)
        return {
          ...m,
          assigned_to: metadata.assigned_to,
          description: metadata.cleanDescription
        }
      })
      const topLevel = all.filter(m => !m.parent_id)
      topLevel.forEach(m => {
        m.submodules = all.filter(s => s.parent_id === m.id)
      })

      set({ modules: { ...get().modules, [projectId]: topLevel } })
    } catch (err) {
      console.error('Failed to fetch modules:', err)
    }
  },

  addModule: async (module) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      const { assigned_to, ...dbModule } = module as any
      const processedModule = serializeModuleMetadata(dbModule, assigned_to || null)
      const payload = { ...processedModule, organization_id: orgId, created_by: profile?.id }
      const { data, error } = await supabase
        .from('project_modules')
        .insert(payload)
        .select()
        .single()

      if (error) throw error

      // Refresh modules for this project
      if (data.project_id) await get().fetchModules(data.project_id)
      
      const parsedData = {
        ...data,
        ...parseModuleMetadata(data)
      }
      return parsedData as ProjectModule
    } catch (err) {
      throw toFriendlyError(err, 'Failed to add module.')
    }
  },

  updateModule: async (id, updates) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      // Find current module
      const currentModule = Object.values(get().modules)
        .flat()
        .flatMap(m => [m, ...(m.submodules || [])])
        .find(m => m.id === id)

      const { assigned_to, ...cleanUpdates } = updates as any

      const fullModule = {
        ...(currentModule || {}),
        ...cleanUpdates
      }

      const processedModule = serializeModuleMetadata(
        fullModule,
        assigned_to !== undefined ? assigned_to : (currentModule as any)?.assigned_to
      )

      const finalUpdates = {
        ...cleanUpdates,
        description: processedModule.description,
        ...( ('assigned_to' in processedModule) ? { assigned_to: processedModule.assigned_to } : {} )
      }

      const { data, error } = await supabase
        .from('project_modules')
        .update(finalUpdates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      if (data.project_id) await get().fetchModules(data.project_id)
    } catch (err) {
      throw toFriendlyError(err, 'Failed to update module.')
    }
  },

  deleteModule: async (id) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      // First get the project_id so we can refresh after delete
      const { data: mod } = await supabase
        .from('project_modules')
        .select('project_id')
        .eq('id', id)
        .single()

      const { error } = await supabase
        .from('project_modules')
        .delete()
        .eq('id', id)

      if (error) throw error
      if (mod?.project_id) await get().fetchModules(mod.project_id)
    } catch (err) {
      throw toFriendlyError(err, 'Failed to delete module.')
    }
  }
}))
