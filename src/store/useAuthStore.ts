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
  signOut: () => Promise<void>
  updateProfile: (data: { full_name?: string; avatar_url?: string }) => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: async (session) => {
    set({ session, user: session?.user ?? null })
    if (session?.user) {
      await get().fetchProfile()
    } else {
      set({ profile: null, isLoading: false })
    }
  },
  fetchProfile: async () => {
    const { user } = get()
    if (!user || !user.id) {
      set({ isLoading: false })
      return
    }
    
    try {
      // 1. Fetch Profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      if (error) throw error
      
      if (!profile) {
        // Fallback: Create initial profile
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0],
            role: 'employee',
            status: 'pending',
            organization_id: '00000000-0000-0000-0000-000000000000'
          })
          .select()
          .maybeSingle()
        
        if (createError) throw createError
        set({ profile: { ...newProfile, permissions: [] } as UserProfile, isLoading: false })
      } else {
        // 2. Fetch Permissions (RBAC)
        const { data: permsData } = await supabase
          .from('profile_roles')
          .select(`
            role_id,
            roles!inner(
              role_permissions(permission_id)
            )
          `)
          .eq('profile_id', user.id)

        const permissions = Array.from(new Set(
          permsData?.flatMap((pr: any) => 
            pr.roles.role_permissions.map((rp: any) => rp.permission_id)
          ) || []
        ))

        set({ profile: { ...profile, permissions } as UserProfile, isLoading: false })
      }
    } catch (err: any) {
      console.error("Error fetching profile:", err)
      set({ isLoading: false })
    }
  },
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  },
  updateProfile: async (data) => {
    // 1. Update Auth Metadata
    const { error: authError } = await supabase.auth.updateUser({
      data: data
    })
    if (authError) throw authError
    
    // 2. Update Public Profile Table
    const { user } = get()
    if (user && data.full_name) {
      const { error: dbError } = await supabase
        .from('profiles')
        .update({ full_name: data.full_name })
        .eq('id', user.id)
      
      if (dbError) console.error("Failed to update public profile:", dbError)
    }

    // 3. Refresh profile
    await get().fetchProfile()
  }
}))
