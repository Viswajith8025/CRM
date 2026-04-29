import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { Project, Milestone } from './types'

interface ProjectsState {
  projects: Project[]
  isLoading: boolean
  error: string | null
  fetchProjects: () => Promise<void>
  addProject: (project: Partial<Project>) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  getProjectById: (id: string) => Promise<Project | null>
  fetchMilestones: (projectId: string) => Promise<Milestone[]>
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  isLoading: false,
  error: null,

  fetchProjects: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          client:clients(name)
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      set({ projects: data as Project[], error: null })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  addProject: async (project) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single()
      
      if (error) throw error
      set({ projects: [data as Project, ...get().projects] })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  updateProject: async (id, updates) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      
      if (error) throw error
      set({
        projects: get().projects.map((p) => (p.id === id ? (data as Project) : p))
      })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  deleteProject: async (id) => {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
      set({ projects: get().projects.filter((p) => p.id !== id) })
    } catch (err: any) {
      set({ error: err.message })
      throw err
    }
  },

  getProjectById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(name)')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Project
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
  }
}))
