import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'manager' | 'employee' | 'client'
  status: 'pending' | 'active' | 'denied'
  email: string | null
  created_at: string
}

interface TeamState {
  members: Profile[]
  isLoading: boolean
  fetchMembers: () => Promise<void>
  updateMemberRole: (id: string, role: Profile['role']) => Promise<void>
  updateMemberStatus: (id: string, status: Profile['status']) => Promise<void>
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

  updateMemberStatus: async (id, status) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', id)

      if (error) throw error
      set({
        members: get().members.map((m) => (m.id === id ? { ...m, status } : m)),
      })
    } catch (error) {
      console.error('Error updating member status:', error)
      throw error
    }
  },

  revokeAccess: async (id) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status: 'denied' })
        .eq('id', id)

      if (error) throw error
      set({
        members: get().members.map((m) => (m.id === id ? { ...m, status: 'denied' } : m)),
      })
    } catch (error) {
      console.error('Error revoking access:', error)
      throw error
    }
  },
}))
