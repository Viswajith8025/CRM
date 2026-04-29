import { create } from 'zustand'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: any | null
  session: any | null
  isLoading: boolean
  setUser: (user: any) => void
  setSession: (session: any) => void
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session, isLoading: false }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null })
  },
}))
