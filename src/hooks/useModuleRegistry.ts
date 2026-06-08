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
    const fetchModules = async () => {
      const { data } = await supabase
        .from('module_registry')
        .select('*')
        .eq('is_enabled', true)
        .order('sort_order')
      
      setModules(data || [])
      setIsModulesLoading(false)
    }

    fetchModules()

    const channelId = `module-registry-${Math.random()}`
    const subscription = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'module_registry' }, () => {
        fetchModules()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [])

  const isSuperAdmin = profile?.role === 'super_admin'
  const isManagementRole = hasPermission('hr.manage_attendance') || hasPermission('module.admin')

  const filter = (category: 'top' | 'bottom') =>
    modules
      .filter(m => m.category === category)
      .filter(m => {
        // Hide personal timesheet from management roles (they use Team Timesheets)
        if (m.key === 'timesheet' && hasPermission('module.admin')) {
          return false
        }
        // Hide Leave Requests from management — they only use Leave Approvals
        if (m.key === 'leave_requests' && isManagementRole) {
          return false
        }
        // Completely remove Audit Trail from sidebar
        if (m.route === '/audit-trail') {
          return false
        }
        // Temporarily hide Super Admin from sidebar
        if (m.route === '/super-admin') {
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
