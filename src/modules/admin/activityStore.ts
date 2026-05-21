import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { ActivityAction, AuditSeverity, AuditTargetType } from '@/lib/auditLogger'

export interface AuditRecord {
  id: string
  user_id: string
  action: ActivityAction | string
  target_type: string
  target_id: string
  target_name: string
  metadata: {
    description?: string
    previous_value?: any
    new_value?: any
    [key: string]: any
  }
  severity: string
  is_system: boolean
  organization_id: string
  created_at: string
  checksum?: string
  profiles?: {
    full_name: string | null
    avatar_url: string | null
  }
}

export interface AuditFilters {
  userId?: string
  action?: string | ''
  targetType?: string | ''
  targetId?: string
  severity?: string | ''
  relatedEntityId?: string
  fromDate?: string
  toDate?: string
  search?: string
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

function mapAuditLogToRecord(row: any): AuditRecord {
  let mappedAction = row.action
  if (mappedAction === 'INSERT') mappedAction = 'CREATE'
  
  let targetName = row.table_name
  const dataToCheck = row.new_data || row.old_data || {}
  if (dataToCheck.name) targetName = dataToCheck.name
  else if (dataToCheck.title) targetName = dataToCheck.title
  else if (dataToCheck.invoice_number) targetName = dataToCheck.invoice_number
  else if (dataToCheck.first_name) targetName = `${dataToCheck.first_name} ${dataToCheck.last_name || ''}`.trim()
  
  let targetType = row.table_name
  if (targetType.endsWith('ies')) targetType = targetType.slice(0, -3) + 'y' // e.g. activities -> activity, categories -> category
  else if (targetType.endsWith('s') && targetType !== 'status') targetType = targetType.slice(0, -1) // e.g. projects -> project

  return {
    id: row.id,
    user_id: row.user_id,
    action: mappedAction,
    target_type: targetType,
    target_id: row.record_id,
    target_name: targetName,
    metadata: {
      description: `Record ${row.action} in ${row.table_name}`,
      previous_value: row.old_data,
      new_value: row.new_data
    },
    severity: row.action === 'DELETE' ? 'critical' : 'info',
    is_system: !row.user_id,
    organization_id: row.organization_id,
    created_at: row.created_at,
    profiles: row.profiles
  }
}

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
        .from('audit_logs')
        .select(`
          id, user_id, action, table_name, record_id, old_data, new_data, organization_id, created_at,
          profiles:user_id ( full_name, avatar_url )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (profile?.role !== 'super_admin' && orgId) {
        query = query.eq('organization_id', orgId)
      }

      if (f.userId)      query = query.eq('user_id', f.userId)
      if (f.action) {
        let dbAction = f.action
        if (dbAction === 'CREATE') dbAction = 'INSERT'
        query = query.eq('action', dbAction)
      }
      if (f.targetType)  query = query.eq('table_name', f.targetType)
      if (f.targetId)    query = query.eq('record_id', f.targetId)
      if (f.fromDate)    query = query.gte('created_at', f.fromDate)
      if (f.toDate)      query = query.lte('created_at', f.toDate)

      const { data, error, count } = await query

      if (error) throw error

      const mapped = (data || []).map(mapAuditLogToRecord)

      set({ 
        records: mapped, 
        activities: mapped, 
        totalCount: count ?? mapped.length, 
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
          table: 'audit_logs',
          ...(profile?.organization_id && profile?.role !== 'super_admin'
            ? { filter: `organization_id=eq.${profile.organization_id}` }
            : {}),
        },
        async (payload) => {
          const { data } = await supabase
            .from('audit_logs')
            .select(`*, profiles:user_id(full_name, avatar_url)`)
            .eq('id', payload.new.id)
            .single()

          if (data) {
            set(state => ({
              records: [mapAuditLogToRecord(data), ...state.records],
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
