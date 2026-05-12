import { create } from 'zustand'
import { supabase } from '../lib/supabase'

import type { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'super_admin' | 'admin' | 'manager' | 'employee' | 'client'
  status: 'pending' | 'active' | 'denied'
  organization_id: string | null
  email: string | null
  created_at: string
  permissions: string[]
  is_org_suspended?: boolean
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
  createMissingProfile: (user: any) => Promise<any>
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
    const currentSession = get().session
    const currentUser = get().user
    
    const isUnchanged = currentSession?.access_token === session?.access_token && currentUser?.id === session?.user?.id
    
    set({ session, user: session?.user ?? null, isLoading: !!session?.user && !isUnchanged })
    
    if (session?.user && !isUnchanged) {
      await get().fetchProfile()
    } else if (!session?.user) {
      set({ profile: null, isLoading: false })
    }
  },

  fetchProfile: async () => {
    const { user } = get()
    if (!user) {
      set({ isLoading: false })
      return
    }

    if ((get() as any)._isFetching) return
    set({ isLoading: true, _isFetching: true } as any)
    
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      if (error) throw error
      
      let is_org_suspended = false
      if (profile && profile.role !== 'super_admin') {
        const { data: orgStatus } = await supabase.rpc('check_org_status', {}, { timeout: 5000 })
        if (orgStatus && orgStatus.status === 'suspended') {
          is_org_suspended = true
        }
      }

      const { data: perms, error: permsError } = await supabase.rpc('get_user_permissions', { p_user_id: user.id }, { timeout: 5000 })
      if (permsError) console.error("Permissions fetch error:", permsError)
      
      const finalProfile = profile || await get().createMissingProfile(user)
      const newProfileState = { ...finalProfile, permissions: perms || [], is_org_suspended } as UserProfile
      
      // DEEP EQUALITY CHECK to prevent reference-based re-render loops
      const currentProfile = get().profile
      const hasChanged = JSON.stringify(currentProfile) !== JSON.stringify(newProfileState)
      
      set({ 
        profile: hasChanged ? newProfileState : currentProfile, 
        isLoading: false,
        _isFetching: false
      } as any)
    } catch (err) {
      console.error("Profile fetch error:", err)
      set({ isLoading: false, _isFetching: false } as any)
    }
  },

  createMissingProfile: async (user: any) => {
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
    return newProfile
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
