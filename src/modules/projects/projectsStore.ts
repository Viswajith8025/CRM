import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import { useTasksStore } from '@/modules/tasks/tasksStore'
import { logActivity } from '@/lib/auditLogger'
import { notificationService } from '@/lib/notificationService'
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
  fetchProjects: (force?: boolean) => Promise<void>
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

  fetchProjects: async (force = false) => {
    const { hasFetched, lastFetchedAt } = get()
    const isFresh = false // Force fresh fetch
    if (!force && hasFetched && isFresh) return
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(name),
          tasks(*, assignee:profiles!assigned_to(id, full_name, email, avatar_url)),
          members:project_members(role, user_id, profiles(full_name, email))
        `)
        .order('created_at', { ascending: false })

      console.log('Fetch Projects - Data:', data, 'Error:', error)
      if (error) throw error

      const projectsWithStats = (data as any[]).map(project => {
        // Extract unique team members from tasks
        const teamMap = new Map()
        project.tasks?.forEach((t: any) => {
          // The query returns the joined profile as 'assignee'
          if (t.assignee) {
            teamMap.set(t.assignee.id, t.assignee)
          } else if (t.assigned_to && typeof t.assigned_to === 'object') {
            teamMap.set(t.assigned_to.id, t.assigned_to)
          }
        })
        
        // Find lead from project_members
        const leadMember = project.members?.find((m: any) => m.role === 'lead')
        const lead = leadMember ? {
          id: leadMember.user_id,
          full_name: leadMember.profiles?.full_name,
          email: leadMember.profiles?.email
        } : undefined

        const totalTasks = project.tasks?.length || 0
        const completedTasks = project.tasks?.filter((t: any) => t.status === 'done').length || 0
        const inProgressTasks = project.tasks?.filter((t: any) => t.status === 'in_progress' || t.status === 'review').length || 0

        // Dynamic Status Calculation
        let dynamicStatus = project.status
        if (project.status !== 'on_hold' && project.status !== 'cancelled') {
          if (totalTasks === 0) {
            dynamicStatus = 'planning'
          } else if (completedTasks === totalTasks) {
            dynamicStatus = 'completed'
          } else if (inProgressTasks > 0 || completedTasks > 0) {
            dynamicStatus = 'in_progress'
          } else {
            dynamicStatus = 'planning'
          }
        }

        return {
          ...project,
          status: dynamicStatus, // Override the DB status with the dynamic one
          team: Array.from(teamMap.values()),
          lead,
          task_stats: {
            total: totalTasks,
            completed: completedTasks
          }
        }
      })

      set({ projects: projectsWithStats as Project[], error: null, hasFetched: true, lastFetchedAt: Date.now() })
    } catch (err) {
      set({ error: getFriendlySupabaseError(err, "Failed to load projects.") })
    } finally {
      set({ isLoading: false })
    }
  },

  addProject: async (project, lead_id, member_ids) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single()

      if (error) throw error
      
      const projectId = data.id
      const memberInserts = []
      const orgId = profile?.organization_id
      
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

      // Audit Log
      logActivity({
        action: 'CREATE',
        targetType: 'project',
        targetId: data.id,
        targetName: data.name,
        description: `New project created: ${data.name}`
      })

      if (lead_id) {
        logActivity({
          action: 'UPDATE',
          targetType: 'project',
          targetId: data.id,
          targetName: data.name,
          description: `Assigned project lead`
        })

        notificationService.notifyProjectUpdate(data.id, data.name, 'assigned to you (Lead)')
      }

      get().fetchProjects(true)
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to add project.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  updateProject: async (id, updates, lead_id, member_ids) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      if (lead_id !== undefined || member_ids !== undefined) {
        // Clear existing members
        await supabase.from('project_members').delete().eq('project_id', id)
        
        const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
        const orgId = profile?.organization_id

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

        if (lead_id) {
          logActivity({
            action: 'UPDATE',
            targetType: 'project',
            targetId: data.id,
            targetName: data.name,
            description: `Updated project lead`
          })

          notificationService.notifyProjectUpdate(data.id, data.name, 'updated (New Lead)')
        }
      }

      // Log Activity
      if (updates.status) {
        logActivity({
          action: 'STATUS_CHANGE',
          targetType: 'project',
          targetId: data.id,
          targetName: data.name,
          description: `Project status changed to ${updates.status.replace('_', ' ')}`
        })
        notificationService.notifyProjectUpdate(data.id, data.name, `changed to ${updates.status.replace('_', ' ')}`)
      } else {
        logActivity({
          action: 'UPDATE',
          targetType: 'project',
          targetId: data.id,
          targetName: data.name,
          description: `Updated project details`
        })
      }

      get().fetchProjects(true)
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to update project.")
      set({ error: friendlyError.message })
      throw friendlyError
    }
  },

  deleteProject: async (id) => {
    const localTaskCount = useTasksStore
      .getState()
      .tasks
      .filter((task) => task.project_id === id)
      .length
    const { count, error: taskError } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id)

    if (taskError) throw toFriendlyError(taskError, "Could not verify whether this project has tasks.")
    const attachedTaskCount = Math.max(count ?? 0, localTaskCount)
    if (attachedTaskCount > 0) {
      throw new Error(`Cannot delete: This project has ${attachedTaskCount} tasks attached. Please reassign or delete them first.`)
    }

    const previousProjects = get().projects
    const deletedProject = previousProjects.find((p) => p.id === id)

    try {
      const { error } = await supabase
        .from('projects')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      logActivity({
        action: 'DELETE',
        targetType: 'project',
        targetId: id,
        targetName: deletedProject?.name || 'Unknown',
        description: `Soft deleted project: ${deletedProject?.name || id}`
      })

      get().fetchProjects(true)
    } catch (err) {
      throw toFriendlyError(err, "Failed to delete project.")
    }
  },

  restoreProject: async (id) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ deleted_at: null })
        .eq('id', id)

      if (error) throw error

      get().fetchProjects(true)

      logActivity({
        action: 'UPDATE',
        targetType: 'project',
        targetId: id,
        targetName: 'Restored Project',
        description: `Restored a previously deleted project`
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to restore project.")
    }
  },
  getProjectById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(name),
          tasks:tasks(id, status, assigned_to:profiles!assigned_to(id, full_name, avatar_url)),
          members:project_members(user_id, role, profiles(full_name, email))
        `)
        .eq('id', id)
        .single()
      if (error) throw error

      const project = data as any
      const teamMap = new Map()
      project.tasks?.forEach((t: any) => {
        if (t.assigned_to) {
          teamMap.set(t.assigned_to.id, t.assigned_to)
        }
      })

      const leadMember = project.members?.find((m: any) => m.role === 'lead')
      const lead = leadMember ? {
        id: leadMember.user_id,
        full_name: leadMember.profiles?.full_name,
        email: leadMember.profiles?.email
      } : undefined

      return {
        ...project,
        team: Array.from(teamMap.values()),
        lead,
        task_stats: {
          total: project.tasks?.length || 0,
          completed: project.tasks?.filter((t: any) => t.status === 'done').length || 0
        }
      } as Project
    } catch (err) {
      return null
    }
  },

  fetchMilestones: async (projectId) => {
    try {
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
      const { error } = await supabase
        .from('project_milestones')
        .insert(milestone)
      if (error) throw error

      // Log Activity
      useActivityStore.getState().logActivity({
        action: 'added milestone',
        target_type: 'milestone',
        target_name: milestone.title || 'New Milestone',
        target_id: milestone.project_id || ''
      })
    } catch (err) {
      throw toFriendlyError(err, "Failed to add milestone.")
    }
  },

  updateMilestone: async (id, updates) => {
    try {
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
      .channel(`projects-${Date.now()}`)
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
      const { data, error } = await supabase
        .from('project_sprints')
        .select('*')
        .eq('project_id', projectId)
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
      const payload = { ...sprint, organization_id: profile?.organization_id }
      
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
      console.error("Error adding sprint:", err)
      throw err
    }
  },

  updateSprint: async (id, updates) => {
    try {
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
      console.error("Error updating sprint:", err)
      throw err
    }
  }
}))
