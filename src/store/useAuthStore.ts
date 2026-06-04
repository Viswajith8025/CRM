import * as zustand from 'zustand'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/auditLogger'

import type { User, Session } from '@supabase/supabase-js'
import type { RealtimeChannel } from '@supabase/supabase-js'

// Module-level singleton — ensures only ONE profile-sync channel exists
// at any time, regardless of how many components call subscribeToProfile.
let _profileChannel: RealtimeChannel | null = null
let _profileChannelUserId: string | null = null

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

export const useAuthStore = zustand.create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  
  subscribeToProfile: () => {
    const { user } = get()
    if (!user) {
      // No user — teardown any existing channel and return a no-op cleanup
      if (_profileChannel) {
        supabase.removeChannel(_profileChannel)
        _profileChannel = null
        _profileChannelUserId = null
      }
      return () => {}
    }

    // If we already have a channel for THIS user, just return the teardown
    if (_profileChannel && _profileChannelUserId === user.id) {
      return () => {
        // Caller-level teardown is intentionally a no-op here;
        // the singleton lives until signOut or a user change.
      }
    }

    // Teardown channel for a DIFFERENT previous user (e.g. after account switch)
    if (_profileChannel) {
      supabase.removeChannel(_profileChannel)
      _profileChannel = null
      _profileChannelUserId = null
    }

    // Create one deterministic channel per user ID (no Math.random or Date.now)
    _profileChannel = supabase
      .channel(`profile-sync-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => {
          get().fetchProfile()
        }
      )
      .subscribe()

    _profileChannelUserId = user.id

    // Return a teardown that fully destroys the singleton (used on signOut)
    return () => {
      if (_profileChannel) {
        supabase.removeChannel(_profileChannel)
        _profileChannel = null
        _profileChannelUserId = null
      }
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

    // Prevent duplicate concurrent fetches
    if ((get() as any)._isFetching) return
    set({ isLoading: true, _isFetching: true } as any)

    // Hard safety timeout — ensures isLoading is ALWAYS cleared
    const timeout = setTimeout(() => {
      console.warn('[Auth] fetchProfile timed out after 10s. Forcing isLoading=false.')
      set({ isLoading: false, _isFetching: false } as any)
    }, 10000)

    try {
      // 1. Try Optimized Bootstrap RPC
      const { data: bootstrapData, error: bootstrapError } = await supabase
        .rpc('bootstrap_user_session', { p_user_id: user.id });

      let finalProfileData = null;
      let dynamicRoleName = null;
      let is_org_suspended = false;
      let perms: any[] = [];

      if (!bootstrapError && bootstrapData && !bootstrapData.error) {
        // Fast Path
        finalProfileData = bootstrapData.profile;
        dynamicRoleName = bootstrapData.dynamic_role;
        is_org_suspended = bootstrapData.is_org_suspended;
        perms = bootstrapData.permissions || [];
      } else {
        // Fallback: 4 Sequential Queries
        if (bootstrapError) {
           console.log("[Auth] Bootstrap RPC not found or failed, falling back to sequential fetch. Please run FIX_HIGH_2_AUTH_HYDRATION.sql");
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        
        finalProfileData = profile;
        if (error) {
          if (error.status === 401 || error.message?.toLowerCase().includes("jwt") || error.message?.toLowerCase().includes("invalid token")) {
            console.warn("[Auth] Invalid or expired credentials detected. Auto-resetting session.");
            await get().signOut();
            return;
          }
          console.warn("[Auth] RLS or fetch error (e.g. empty string cast). Proceeding to fallback profile creation:", error);
        }

        if (profile) {
          try {
            const { data: userRoleData, error: rpcError } = await supabase
              .rpc('get_user_dynamic_role', { p_user_id: user.id })
            
            if (!rpcError && userRoleData && userRoleData.length > 0) {
              dynamicRoleName = userRoleData[0].role_name
            } else {
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
        
        if (profile && profile.role !== 'super_admin') {
          try {
            const { data: orgStatus } = await supabase.rpc('check_org_status')
            if (orgStatus && orgStatus.status === 'suspended') {
              is_org_suspended = true
            }
          } catch (orgErr) {
            console.error("Org status check error:", orgErr)
          }
        }

        try {
          const { data, error: permsError } = await supabase.rpc('get_user_permission_codes_v2', { p_user_id: user.id })
          if (permsError) console.error("Permissions fetch error:", permsError)
          perms = data || []
        } catch (permErr) {
          console.error("Permissions RPC threw error:", permErr)
        }
      }
      
      const finalProfile = finalProfileData
      // SECURITY: If no profile row found, this is an unauthorized or unregistered user.
      // We do NOT auto-create a profile. We log the critical event and deny access.
      if (!finalProfile) {
        console.error('[Auth] SECURITY: No profile found for authenticated user. Denying access and signing out.', { userId: user.id, email: user.email })
        logActivity({
          action: 'PERMISSION_CHANGE',
          targetType: 'user',
          targetId: user.id,
          targetName: user.email || user.id,
          description: `SECURITY ALERT: Authenticated user has no profile row. Access denied. Email: ${user.email}`,
          severity: 'critical',
        })
        clearTimeout(timeout)
        set({ isLoading: false, _isFetching: false } as any)
        await get().signOut()
        return
      }
      const newProfileState = { 
        ...(finalProfile || { role: 'employee', status: 'pending' }), 
        dynamic_role: dynamicRoleName,
        permissions: perms.map((p: any) => p.permission_code || p), // handle both RPC result formats
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
      clearTimeout(timeout)
    } catch (err) {
      console.error("Profile fetch error:", err)
      clearTimeout(timeout)
      set({ isLoading: false, _isFetching: false } as any)
    }
  },

  createMissingProfile: async (user: any) => {
    // DEPRECATED: This function is kept only for the registerOrganization flow
    // where a brand-new OAuth user needs their first profile created after
    // completing the organization setup wizard. It MUST NOT be called in
    // the general fetchProfile path. See security hardening above.
    console.warn('[Auth] createMissingProfile called. This should only happen during organization registration.')
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
