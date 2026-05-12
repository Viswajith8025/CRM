import { NavLink } from "react-router-dom" // Sidebar
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
  TrendingUp
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useAuthStore } from "@/store/useAuthStore"

const topNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'CRM Leads', href: '/crm', icon: Target, roles: ['super_admin', 'admin', 'manager'] },
  { name: 'Active Clients', href: '/clients', icon: Building2, roles: ['super_admin', 'admin', 'manager'] },
  { name: 'Projects', href: '/projects', icon: Briefcase, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Teams', href: '/teams', icon: Users, roles: ['super_admin', 'admin', 'manager'] },
  { name: 'Billing', href: '/billing', icon: FileText, roles: ['super_admin', 'admin'] }, // Billing is sensitive
  { name: 'Scheduler', href: '/calendar', icon: CalendarIcon, roles: ['super_admin', 'admin', 'manager', 'employee'] },
  { name: 'HR & Payroll', href: '/hr', icon: Users, roles: ['super_admin', 'admin', 'manager'] }, // HR is sensitive
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['super_admin', 'admin', 'manager'] },
  { name: 'Profitability', href: '/reports/profitability', icon: TrendingUp, roles: ['super_admin', 'admin'] }, // Money stats = admin
  { name: 'Document Vault', href: '/documents', icon: Files, roles: ['super_admin', 'admin', 'manager'] },
  { name: 'Executive', href: '/executive', icon: Shield, roles: ['super_admin', 'admin'] },
]

const bottomNavigation = [
  { name: 'Super Admin', href: '/super-admin', icon: Shield, roles: ['super_admin'] },
  { name: 'Audit Trail', href: '/audit-trail', icon: ClipboardList, roles: ['super_admin', 'admin'] },
  { name: 'Settings', href: '/settings', icon: Settings, roles: ['super_admin', 'admin'] },
  { name: 'Support', href: '/support', icon: LifeBuoy, roles: ['super_admin', 'admin', 'manager'] },
]

export function Sidebar() {
  const { profile } = useAuthStore()

  const filterNav = (items: typeof topNavigation) => items.filter(item => {
    if (!item.roles) return true
    return profile && item.roles.includes(profile.role)
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
