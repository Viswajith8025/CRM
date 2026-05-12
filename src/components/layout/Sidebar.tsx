import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Target,
  Briefcase,
  CheckSquare,
  FileText,
  BarChart3,
  Settings,
  Building2,
  LifeBuoy,
  Shield,
  Calendar as CalendarIcon,
  ClipboardList,
  Files,
  TrendingUp,
  ShieldCheck,
  Lock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { usePermissions } from "@/hooks/usePermissions.tsx"

const topNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'CRM Leads', href: '/crm', icon: Target, permission: 'crm.view' },
  { name: 'Active Clients', href: '/clients', icon: Building2, permission: 'crm.view' },
  { name: 'Projects', href: '/projects', icon: Briefcase, permission: 'projects.view' },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare, permission: 'tasks.view' },
  { name: 'Teams', href: '/teams', icon: Users, permission: 'hr.view' },
  { name: 'Billing', href: '/billing', icon: FileText, permission: 'billing.view' },
  { name: 'Scheduler', href: '/calendar', icon: CalendarIcon },
  { name: 'HR & Payroll', href: '/hr', icon: Users, permission: 'hr.view' },
  { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'reports.view' },
  { name: 'Document Vault', href: '/documents', icon: Files },
  { name: 'Executive', href: '/executive', icon: Shield, permission: 'billing.view' },
]

const bottomNavigation = [
  { name: 'Roles & Access', href: '/roles', icon: Lock, permission: 'roles.manage' },
  { name: 'Super Admin', href: '/super-admin', icon: ShieldCheck, permission: 'roles.manage' },
  { name: 'Audit Trail', href: '/audit-trail', icon: ClipboardList, permission: 'roles.manage' },
  { name: 'Settings', href: '/settings', icon: Settings, permission: 'roles.manage' },
  { name: 'Support', href: '/support', icon: LifeBuoy, permission: 'support.view' },
]

import { useAuthStore } from "@/store/useAuthStore"

export function Sidebar() {
  const { hasPermission } = usePermissions()
  const { profile } = useAuthStore()
  const isSuperAdmin = profile?.role === 'super_admin'

  const filterNav = (items: any[]) => items.filter(item => {
    // 1. Hard restriction for Admin/RBAC modules to Super Admin only
    const adminModules = ['Roles & Access', 'Super Admin', 'Audit Trail', 'Settings']
    if (adminModules.includes(item.name) && !isSuperAdmin) {
      return false
    }

    if (!item.permission) return true
    return hasPermission(item.permission)
  })

  const filteredTop = filterNav(topNavigation)
  const filteredBottom = filterNav(bottomNavigation)

  return (
    <div className="flex h-full flex-col gap-y-5 overflow-y-auto border-r border-border/50 bg-card/50 backdrop-blur-xl pb-4">
      <div className="flex h-32 shrink-0 items-center justify-center border-b border-white/5 overflow-hidden">
        <img src="/logogpt.png" alt="Logo" className="h-28 w-auto object-contain brightness-125 scale-125 drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]" />
      </div>
      <nav className="flex flex-1 flex-col px-6 mt-4">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1.5">
              {filteredTop.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) => cn(
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      'group relative flex gap-x-3 rounded-xl p-3 text-sm font-bold leading-6 transition-all duration-200'
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          isActive ? "text-primary" : "group-hover:text-foreground"
                        )} aria-hidden="true" />
                        {item.name}
                        {isActive && (
                          <motion.div
                            layoutId="active-nav"
                            className="absolute left-0 w-1 h-6 bg-primary rounded-r-full top-1/2 -translate-y-1/2"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>

          <li className="mt-auto">
            <ul role="list" className="-mx-2 space-y-1.5">
              {filteredBottom.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) => cn(
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      'group relative flex gap-x-3 rounded-xl p-3 text-sm font-bold leading-6 transition-all duration-200'
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={cn(
                          "h-5 w-5 shrink-0 transition-colors",
                          isActive ? "text-primary" : "group-hover:text-foreground"
                        )} aria-hidden="true" />
                        {item.name}
                        {isActive && (
                          <motion.div
                            layoutId="active-nav"
                            className="absolute left-0 w-1 h-6 bg-primary rounded-r-full top-1/2 -translate-y-1/2"
                          />
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  )
}
