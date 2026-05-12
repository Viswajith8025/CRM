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
    setIsLoading(true)
    try {
      const { profile } = useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      let query = baseQuery || supabase
        .from(tableName)
        .select(select, { count: 'exact' })
        .eq('organization_id', orgId)

      // Apply Filters
      Object.entries(filters).forEach(([key, value]) => {
        if (value) query = query.eq(key, value)
      })

      // Apply Search (Generic simple search, can be customized)
      if (search) {
        // This is a simple ilike. For more complex search, you might need a different strategy
        // We'll try to find a searchable column or just use name/title/description
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
      toast.error(`Failed to load ${tableName} data.`)
    } finally {
      setIsLoading(false)
    }
  }, [tableName, baseQuery, select, page, filters, search, sort, pageSize])

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
