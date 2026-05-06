import { create } from 'zustand'
import { supabase } from '../lib/supabase'

import type { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'admin' | 'manager' | 'employee' | 'client'
  status: 'pending' | 'active' | 'denied'
  organization_id: string | null
  email: string | null
  created_at: string
  permissions: string[]
}

interface AuthState {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  fetchProfile: () => Promise<void>
  subscribeToProfile: () => (() => void)
  signOut: () => Promise<void>
  updateProfile: (data: { full_name?: string; avatar_url?: string }) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  
  subscribeToProfile: () => {
    const { user } = get()
    if (!user) return () => {}

    // Unique channel per mount to avoid "callbacks after subscribe" errors
    const channel = supabase.channel(`profile-sync-${user.id}-${Date.now()}`)
    
    channel.on(
      'postgres_changes',
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'profiles', 
        filter: `id=eq.${user.id}` 
      },
      () => {
        get().fetchProfile()
      }
    )
    
    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  },

  setSession: async (session) => {
    set({ session, user: session?.user ?? null, isLoading: !!session?.user })
    if (session?.user) {
      await get().fetchProfile()
    } else {
      set({ profile: null, isLoading: false })
    }
  },

  fetchProfile: async () => {
    const { user } = get()
    if (!user) {
      set({ isLoading: false })
      return
    }
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      if (error) throw error
      
      if (!profile) {
        // Create if missing (failsafe)
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: 'employee',
            status: 'pending'
          })
          .select()
          .single()
        
        set({ profile: { ...newProfile, permissions: [] } as UserProfile, isLoading: false })
      } else {
        set({ profile: { ...profile, permissions: [] } as UserProfile, isLoading: false })
      }
    } catch (err) {
      console.error("Profile fetch error:", err)
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null, isLoading: false })
  },

  updateProfile: async (data) => {
    const { user } = get()
    if (!user) return
    
    await supabase.from('profiles').update(data).eq('id', user.id)
    await get().fetchProfile()
  }
}))
