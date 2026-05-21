import { create } from 'zustand'
import { supabase } from '../lib/supabase'

import type { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: 'super_admin' | 'admin' | 'manager' | 'employee' | 'client'
  dynamic_role?: string | null // The dynamic name from the 'roles' table
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
  updateProfile: (data: Partial<UserProfile>) => Promise<void>
  createMissingProfile: (user: any) => Promise<any>
  registerOrganization: (orgName: string, userFullName?: string) => Promise<string>
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
      // 1. Fetch Profile
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()
      
      if (error) {
        // Self-healing safeguard: if token is invalid, expired, or unauthorized (401), clear session and sign out
        if (error.status === 401 || error.message?.toLowerCase().includes("jwt") || error.message?.toLowerCase().includes("invalid token")) {
          console.warn("[Auth] Invalid or expired credentials detected. Auto-resetting session.");
          await get().signOut();
          return;
        }
        throw error
      }

      // 2. Resolve Dynamic Role Name
      let dynamicRoleName = null
      if (profile) {
        try {
          const { data: userRoleData, error: rpcError } = await supabase
            .rpc('get_user_dynamic_role', { p_user_id: user.id })
          
          if (!rpcError && userRoleData && userRoleData.length > 0) {
            dynamicRoleName = userRoleData[0].role_name
          } else {
            // Fallback manual query
            const { data: qData } = await supabase
              .from('user_roles')
              .select('roles(name)')
              .eq('user_id', user.id)
              .limit(1)
            if (qData && qData.length > 0) {
              const roleInfo = qData[0].roles
              dynamicRoleName = Array.isArray(roleInfo) ? roleInfo[0]?.name : (roleInfo as any)?.name
            }
          }
        } catch (roleErr) {
          console.error("Dynamic role resolution error:", roleErr)
        }
      }
      
      // 3. Check Org Status
      let is_org_suspended = false
      if (profile && profile.role !== 'super_admin') {
        const { data: orgStatus } = await supabase.rpc('check_org_status', {}, { timeout: 5000 })
        if (orgStatus && orgStatus.status === 'suspended') {
          is_org_suspended = true
        }
      }

      // 4. Resolve Permissions
      const { data: perms, error: permsError } = await supabase.rpc('get_user_permission_codes_v2', { p_user_id: user.id }, { timeout: 5000 })
      if (permsError) console.error("Permissions fetch error:", permsError)
      
      const finalProfile = profile || await get().createMissingProfile(user)
      const newProfileState = { 
        ...finalProfile, 
        dynamic_role: dynamicRoleName,
        permissions: (perms || []).map((p: any) => p.permission_code || p), // handle both RPC result formats
        is_org_suspended 
      } as UserProfile
      
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
        status: 'pending',
        organization_id: '00000000-0000-0000-0000-000000000000'
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
  },

  registerOrganization: async (orgName: string, userFullName?: string) => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase.rpc('register_organization_with_owner', {
        p_org_name: orgName,
        p_user_full_name: userFullName || null
      })

      if (error) {
        console.error("Organization Registration Failed:", error)
        throw new Error(error.message || "Failed to register organization.")
      }

      // Re-fetch the profile immediately since they are now a super_admin of the new org
      await get().fetchProfile()
      return data // Returns the new UUID
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  }
}))
