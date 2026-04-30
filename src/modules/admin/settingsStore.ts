import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface OrgSettings {
  id: string
  company_name: string
  tax_id: string | null
  corporate_email: string | null
  website: string | null
  logo_url: string | null
}

interface SettingsState {
  settings: OrgSettings | null
  isLoading: boolean
  fetchSettings: () => Promise<void>
  updateSettings: (settings: Partial<OrgSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  isLoading: false,

  fetchSettings: async () => {
    set({ isLoading: true })
    try {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('*')
        .single()

      if (error && error.code !== 'PGRST116') throw error
      set({ settings: data })
    } catch (error) {
      console.error('Error fetching settings:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  updateSettings: async (updates) => {
    const current = get().settings
    if (!current) return

    try {
      const { error } = await supabase
        .from('organization_settings')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', current.id)

      if (error) throw error
      set({ settings: { ...current, ...updates } })
    } catch (error) {
      console.error('Error updating settings:', error)
      throw error
    }
  },
}))
