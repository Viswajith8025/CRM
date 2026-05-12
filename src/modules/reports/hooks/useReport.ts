import { useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from 'sonner'

interface UseReportProps {
  tableName: string
  baseQuery?: any
  select?: string
  defaultFilters?: Record<string, any>
  pageSize?: number
}

export function useReport<T>({
  tableName,
  baseQuery,
  select = '*',
  defaultFilters = {},
  pageSize = 20
}: UseReportProps) {
  const [data, setData] = useState<T[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters)
  const [search, setSearch] = useState("")
  const [sort, setSort] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null)

  const fetchData = useCallback(async () => {
    // PREVENT DUPES
    if ((fetchData as any)._isFetching) return
    (fetchData as any)._isFetching = true
    
    setIsLoading(true)
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      
      // ABORT if no organization context - prevents loop on logout
      if (!orgId) {
        setIsLoading(false)
        (fetchData as any)._isFetching = false
        return
      }

      let query = baseQuery || supabase
        .from(tableName)
        .select(select, { count: 'exact' })
        .eq('organization_id', orgId)

      // Apply Filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          query = query.eq(key, value)
        }
      })

      // Apply Search
      if (search) {
        query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,name.ilike.%${search}%,title.ilike.%${search}%`)
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

      const { data: result, error, count } = await query

      if (error) throw error

      setData(result || [])
      setTotalCount(count || 0)
    } catch (err: any) {
      console.error(`Error fetching ${tableName} report:`, err)
    } finally {
      setIsLoading(false)
      ;(fetchData as any)._isFetching = false
    }
  }, [tableName, JSON.stringify(filters), search, JSON.stringify(sort), page, pageSize, select])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return {
    data,
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
