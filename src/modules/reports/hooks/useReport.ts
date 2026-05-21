
import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from 'sonner'

interface UseReportProps {
  tableName: string
  baseQuery?: any
  select?: string
  defaultFilters?: Record<string, any>
  pageSize?: number
  searchFields?: string[]
  defaultSortBy?: string
}

export function useReport<T>({
  tableName,
  baseQuery,
  select = '*',
  defaultFilters = {},
  pageSize = 20,
  searchFields = ['full_name', 'email', 'name', 'title', 'invoice_number', 'description'],
  defaultSortBy = 'created_at'
}: UseReportProps) {
  const [data, setData] = useState<T[]>([])
  const [aggregates, setAggregates] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' }>({ key: defaultSortBy, order: 'desc' })
  
  const abortControllerRef = useRef<AbortController | null>(null)
  const isFetchingRef = useRef(false)

  const fetchData = useCallback(async () => {
    // Prevent overlapping requests
    if (isFetchingRef.current) {
      abortControllerRef.current?.abort()
    }
    
    const { profile } = useAuthStore.getState()
    const orgId = profile?.organization_id
    
    // Crucial: Wait for organization context to be available
    if (!orgId) {
      setIsLoading(false)
      return
    }

    isFetchingRef.current = true
    setIsLoading(true)
    
    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      let query = baseQuery || supabase
        .from(tableName)
        .select(select, { count: 'exact' })

      // Apply Multi-Tenancy Isolation
      query = query.eq('organization_id', orgId)

      // Apply Filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            query = query.in(key, value)
          } else {
            query = query.eq(key, value)
          }
        }
      })

      // Apply Search (Enterprise search across common fields)
      if (search) {
        // Build OR query for common fields
        const orQuery = searchFields.map(f => `${f}.ilike.%${search}%`).join(',')
        query = query.or(orQuery)
      }

      // Apply Sort
      if (sort) {
        query = query.order(sort.key, { ascending: sort.order === 'asc' })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      // Apply Pagination
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      // Execute with Abort Signal
      const { data: result, error, count } = await query.abortSignal(controller.signal)

      if (error) {
        if (error.code === 'PGRST116') return // Swallowed aborted request
        throw error
      }

      setData(result || [])
      setTotalCount(count || 0)

      // Fetch Server-Side Aggregates for specific reports to prevent client-side crash
      if (['invoices', 'renewals', 'projects', 'tasks'].includes(tableName)) {
        // Map table name to report type
        const reportTypeMap: Record<string, string> = {
          'invoices': 'invoices',
          'renewals': 'renewals',
          'projects': 'profitability', // Or projects
          'tasks': 'productivity'
        }
        
        try {
          const { data: aggData } = await supabase.rpc('get_report_aggregates', {
            p_report_type: reportTypeMap[tableName],
            p_org_id: orgId,
            p_filters: filters,
            p_search: search || null
          }).abortSignal(controller.signal)
          
          if (aggData && !aggData.error) {
            setAggregates(aggData)
          }
        } catch (aggErr) {
          console.warn("Failed to fetch server aggregates, falling back to basic metrics", aggErr)
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message?.includes('AbortError')) return
      console.error(`[Enterprise Report] Fetch Error (${tableName}):`, err)
      toast.error(`Reporting failure in ${tableName} module.`)
    } finally {
      setIsLoading(false)
      isFetchingRef.current = false
    }
  }, [tableName, JSON.stringify(filters), search, JSON.stringify(sort), page, pageSize, select])

  // Re-fetch only when core dependencies change
  useEffect(() => {
    fetchData()
    return () => abortControllerRef.current?.abort()
  }, [fetchData])

  return {
    data,
    aggregates,
    isLoading,
    totalCount,
    page,
    setPage,
    filters,
    setFilters,
    setSearch,
    setSort,
    refresh: fetchData
  }
}
