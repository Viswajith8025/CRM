import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { getFriendlySupabaseError, toFriendlyError } from '@/lib/supabaseError'
import { useTasksStore } from '@/modules/tasks/tasksStore'
import type { Project, Milestone } from './types'

const CACHE_TTL_MS = 5 * 60 * 1000

interface ProjectsState {
  projects: Project[]
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
  subscribeToProjects: () => () => void
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,
  hasFetched: false,
  lastFetchedAt: null,

  fetchProjects: async (force = false) => {
    const { hasFetched, lastFetchedAt } = get()
    const isFresh = lastFetchedAt !== null && Date.now() - lastFetchedAt < CACHE_TTL_MS
    if (!force && hasFetched && isFresh) return
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(name),
          tasks:tasks(id, status, assigned_to:profiles!assigned_to(id, full_name, avatar_url)),
          members:project_members(user_id, role, profiles(full_name, email))
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const projectsWithStats = (data as any[]).map(project => {
        // Extract unique team members from tasks
        const teamMap = new Map()
        project.tasks?.forEach((t: any) => {
          if (t.assigned_to) {
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

        return {
          ...project,
          team: Array.from(teamMap.values()),
          lead,
          task_stats: {
            total: project.tasks?.length || 0,
            completed: project.tasks?.filter((t: any) => t.status === 'done').length || 0
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
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single()

      if (error) throw error
      
      const projectId = data.id
      const memberInserts = []
      
      if (lead_id) {
        memberInserts.push({ project_id: projectId, user_id: lead_id, role: 'lead' })
      }
      
      if (member_ids && member_ids.length > 0) {
        member_ids.forEach(id => {
          if (id !== lead_id) {
            memberInserts.push({ project_id: projectId, user_id: id, role: 'member' })
          }
        })
      }
      
      if (memberInserts.length > 0) {
        await supabase.from('project_members').insert(memberInserts)
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
        
        const memberInserts = []
        if (lead_id) {
          memberInserts.push({ project_id: id, user_id: lead_id, role: 'lead' })
        }
        
        if (member_ids && member_ids.length > 0) {
          member_ids.forEach(userId => {
            if (userId !== lead_id) {
              memberInserts.push({ project_id: id, user_id: userId, role: 'member' })
            }
          })
        }
        
        if (memberInserts.length > 0) {
          await supabase.from('project_members').insert(memberInserts)
        }
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
    const deletedIndex = previousProjects.findIndex((p) => p.id === id)
    set({ projects: previousProjects.filter((p) => p.id !== id) })

    try {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
      set({ error: null, lastFetchedAt: Date.now() })
    } catch (err) {
      const friendlyError = toFriendlyError(err, "Failed to delete project.")
      set((state) => {
        if (!deletedProject || state.projects.some((project) => project.id === id)) {
          return { error: friendlyError.message }
        }

        const projects = [...state.projects]
        projects.splice(Math.max(deletedIndex, 0), 0, deletedProject)
        return { projects, error: friendlyError.message }
      })
      throw friendlyError
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
      .channel('projects-realtime')
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
  }
}))
