import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'manager' | 'employee' | 'client'
  email: string | null
  created_at: string
}

interface TeamState {
  members: Profile[]
  isLoading: boolean
  fetchMembers: () => Promise<void>
  updateMemberRole: (id: string, role: Profile['role']) => Promise<void>
  revokeAccess: (id: string) => Promise<void>
}

export const useTeamStore = create<TeamState>((set, get) => ({
  members: [],
  isLoading: false,

  fetchMembers: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })

      if (error) throw error
      set({ members: data || [] })
    } catch (error) {
      console.error('Error fetching team members:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  updateMemberRole: async (id, role) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', id)

      if (error) throw error
      set({
        members: get().members.map((m) => (m.id === id ? { ...m, role } : m)),
      })
    } catch (error) {
      console.error('Error updating member role:', error)
      throw error
    }
  },

  revokeAccess: async (id) => {
    // In a real app, this might involve calling an edge function to disable the user in Auth
    // For now, we'll just remove them from the profiles table or mark as inactive if we had a status
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id)

      if (error) throw error
      set({
        members: get().members.filter((m) => m.id !== id),
      })
    } catch (error) {
      console.error('Error revoking access:', error)
      throw error
    }
  },
}))
