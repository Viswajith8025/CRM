import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { usePermissions } from '@/hooks/usePermissions'
import { useAuthStore } from '@/store/useAuthStore'

export interface ModuleEntry {
  id: string
  key: string
  name: string
  icon: string
  route: string
  category: 'top' | 'bottom'
  sort_order: number
  permission: string
  is_enabled: boolean
}

export function useModuleRegistry() {
  const [modules, setModules] = useState<ModuleEntry[]>([])
  const [isModulesLoading, setIsModulesLoading] = useState(true)
  const { hasPermission, isLoading: isPermissionsLoading } = usePermissions()
  const { profile } = useAuthStore()

  useEffect(() => {
    supabase
      .from('module_registry')
      .select('*')
      .eq('is_enabled', true)
      .order('sort_order')
      .then(({ data }) => {
        setModules(data || [])
        setIsModulesLoading(false)
      })
  }, [])

  const isSuperAdmin = profile?.role === 'super_admin'

  const MANAGEMENT_ROLES = ['super_admin', 'admin', 'hr']
  const isManagementRole = MANAGEMENT_ROLES.includes(profile?.role || '')

  const filter = (category: 'top' | 'bottom') =>
    modules
      .filter(m => m.category === category)
      .filter(m => {
        // Hide personal timesheet from management roles (they use Team Timesheets)
        if (m.key === 'timesheet' && (profile?.role === 'super_admin' || profile?.role === 'admin')) {
          return false
        }
        // Hide Leave Requests from management — they only use Leave Approvals
        if (m.key === 'leave_requests' && isManagementRole) {
          return false
        }
        return isSuperAdmin || hasPermission(m.permission)
      })

  return { 
    top: filter('top'), 
    bottom: filter('bottom'), 
    isLoading: isModulesLoading || isPermissionsLoading 
  }
}
