import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ActivityAction, AuditSeverity, AuditTargetType } from '@/lib/auditLogger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuditRecord {
  id: string
  user_id: string
  action: ActivityAction
  target_type: AuditTargetType
  target_id: string
  target_name: string
  metadata: {
    description?: string
    previous_value?: string | number | null
    new_value?: string | number | null
    related_entity_id?: string
    related_entity_type?: string
    [key: string]: any
  }
  severity: AuditSeverity
  is_system: boolean
  organization_id: string
  created_at: string
  checksum?: string
  // joined from profiles
  profiles?: {
    full_name: string | null
    avatar_url: string | null
  }
}

export interface AuditFilters {
  userId?: string
  action?: ActivityAction | ''
  targetType?: AuditTargetType | ''
  targetId?: string
  severity?: AuditSeverity | ''
  relatedEntityId?: string
  fromDate?: string   // ISO string
  toDate?: string     // ISO string
  search?: string     // text search on target_name / description
  limit?: number
  page?: number
}

interface AuditState {
  records: AuditRecord[]
  activities: AuditRecord[]
  totalCount: number
  isLoading: boolean
  error: string | null
  filters: AuditFilters
  
  fetchAuditTrail: (filters?: AuditFilters) => Promise<void>
  fetchActivities: (filters?: AuditFilters) => Promise<void>
  setFilters: (filters: Partial<AuditFilters>) => void
  resetFilters: () => void
  subscribeToAudit: () => () => void
  subscribeToActivities: () => () => void
}

const DEFAULT_FILTERS: AuditFilters = {
  limit: 50,
  page: 1,
  fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  toDate: new Date().toISOString(),
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuditStore = create<AuditState>((set, get) => ({
  records: [],
  activities: [],
  totalCount: 0,
  isLoading: false,
  error: null,
  filters: DEFAULT_FILTERS,

  setFilters: (filters) => {
    set(state => ({ filters: { ...state.filters, ...filters, page: 1 } }))
  },

  resetFilters: () => {
    set({ filters: DEFAULT_FILTERS })
  },

  fetchAuditTrail: async (overrideFilters?) => {
    set({ isLoading: true, error: null })

    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId && profile?.role !== 'super_admin') throw new Error('No organization context.')

      const f = { ...get().filters, ...overrideFilters }
      const limit = f.limit ?? 50
      const page = f.page ?? 1
      const offset = (page - 1) * limit

      let query = supabase
        .from('activities')
        .select(`
          id, user_id, action, target_type, target_id, target_name,
          metadata, severity, is_system, organization_id, created_at, checksum,
          profiles:user_id ( full_name, avatar_url )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      // Org scoping (super_admin skips this)
      if (profile?.role !== 'super_admin' && orgId) {
        query = query.eq('organization_id', orgId)
      }

      // Apply filters
      if (f.userId)      query = query.eq('user_id', f.userId)
      if (f.action)      query = query.eq('action', f.action)
      if (f.targetType)  query = query.eq('target_type', f.targetType)
      if (f.targetId)    query = query.eq('target_id', f.targetId)
      if (f.severity)    query = query.eq('severity', f.severity)
      if (f.fromDate)    query = query.gte('created_at', f.fromDate)
      if (f.toDate)      query = query.lte('created_at', f.toDate)

      // Text search (matches target_name or description inside metadata)
      if (f.search) {
        query = query.ilike('target_name', `%${f.search}%`)
      }

      const { data, error, count } = await query

      if (error) throw error

      let results = (data ?? []) as AuditRecord[]

      // If looking for a related entity, also query for activities referencing this ID
      if (f.relatedEntityId && f.relatedEntityId !== f.targetId) {
        const { data: relatedData } = await supabase
          .from('activities')
          .select(`id, user_id, action, target_type, target_id, target_name, metadata, severity, is_system, organization_id, created_at, checksum, profiles:user_id(full_name, avatar_url)`)
          .eq('target_id', f.relatedEntityId)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (relatedData) {
          const ids = new Set(results.map(r => r.id))
          const merged = [
            ...results,
            ...(relatedData as AuditRecord[]).filter(r => !ids.has(r.id))
          ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          results = merged
        }
      }

      set({ 
        records: results, 
        activities: results, 
        totalCount: count ?? results.length, 
        error: null 
      })
    } catch (err: any) {
      set({ error: err.message })
    } finally {
      set({ isLoading: false })
    }
  },

  fetchActivities: (filters) => get().fetchAuditTrail(filters),

  subscribeToAudit: () => {
    const { profile } = (() => {
      try {
        // Dynamic import is async, so we use a closure-safe way to get the state
        // or assume the store is already initialized in the browser.
        return (window as any).useAuthStore?.getState() || { profile: null };
      } catch {
        return { profile: null }
      }
    })()

    const channel = supabase
      .channel(`audit-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activities',
          // If org-scoped, filter at channel level for efficiency
          ...(profile?.organization_id && profile?.role !== 'super_admin'
            ? { filter: `organization_id=eq.${profile.organization_id}` }
            : {}),
        },
        async (payload) => {
          // Fetch with profile join for the new record
          const { data } = await supabase
            .from('activities')
            .select(`*, profiles:user_id(full_name, avatar_url)`)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            set(state => ({
              records: [data as AuditRecord, ...state.records],
              totalCount: state.totalCount + 1,
            }))
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  },

  subscribeToActivities: () => get().subscribeToAudit(),
}))

export const useActivityStore = useAuditStore
