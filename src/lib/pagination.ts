import { PostgrestFilterBuilder } from '@supabase/postgrest-js'

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  filters?: Record<string, any>
}

export interface PaginatedResponse<T> {
  data: T[]
  totalCount: number
  page: number
  limit: number
  totalPages: number
}

/**
 * Enterprise Pagination Utility
 * 
 * Standardizes server-side pagination, sorting, and filtering for Supabase queries.
 */
export async function fetchPaginatedData<T>(
  baseQuery: any, // Accepts the supabase.from('table').select(...) base
  params: PaginationParams
): Promise<PaginatedResponse<T>> {
  const { page, limit, sortBy, sortOrder = 'desc', filters } = params
  
  let query = baseQuery

  // 1. Apply Filters
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        query = query.eq(key, value)
      }
    })
  }

  // 2. Apply Sorting
  if (sortBy) {
    query = query.order(sortBy, { ascending: sortOrder === 'asc' })
  }

  // 3. Apply Pagination (Range)
  const from = (page - 1) * limit
  const to = from + limit - 1

  // 4. Execute with Count (Using exact count for pagination)
  // Note: We expect the baseQuery to NOT have called .then() or similar yet
  const { data, count, error } = await query
    .range(from, to)

  if (error) throw error

  const totalCount = count || 0
  
  return {
    data: data as T[] || [],
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit)
  }
}

/**
 * Hook-ready metadata for UI components
 */
export const getPaginationState = (totalCount: number, page: number, limit: number) => {
  const totalPages = Math.ceil(totalCount / limit)
  return {
    from: (page - 1) * limit + 1,
    to: Math.min(page * limit, totalCount),
    totalCount,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  }
}
