import { NavLink } from "react-router-dom"
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  CheckSquare, 
  Clock, 
  FileText, 
  BarChart3, 
  Settings,
  HelpCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useAuthStore } from "@/store/useAuthStore"

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'CRM Leads', href: '/crm', icon: Users },
  { name: 'Projects', href: '/projects', icon: Briefcase },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Time Tracking', href: '/time-tracking', icon: Clock },
  { name: 'Billing', href: '/billing', icon: FileText },
  { name: 'Reports', href: '/reports', icon: BarChart3, roles: ['admin', 'manager'] },
]

export function Sidebar() {
  const { profile } = useAuthStore()

  const filteredNavigation = navigation.filter(item => {
    if (!item.roles) return true
    return profile && item.roles.includes(profile.role)
  })

  return (
    <div className="flex h-full flex-col gap-y-5 overflow-y-auto border-r border-border/50 bg-card/50 backdrop-blur-xl px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <div className="h-4 w-4 bg-primary-foreground rounded-sm rotate-45" />
        </div>
        <span className="text-xl font-black tracking-tighter text-foreground">
          ERP<span className="text-primary">PRO</span>
        </span>
      </div>
      <nav className="flex flex-1 flex-col mt-4">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1.5">
              {filteredNavigation.map((item) => (
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
            {profile?.role === 'admin' && (
              <NavLink
                to="/settings"
                className="group -mx-2 flex gap-x-3 rounded-xl p-3 text-sm font-bold leading-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all"
              >
                <Settings className="h-5 w-5 shrink-0 group-hover:text-foreground" aria-hidden="true" />
                Settings
              </NavLink>
            )}
            <div 
              onClick={() => window.open('mailto:support@erppro.com', '_blank')}
              className="group -mx-2 flex gap-x-3 rounded-xl p-3 text-sm font-bold leading-6 text-muted-foreground hover:bg-accent hover:text-accent-foreground cursor-pointer transition-all"
            >
              <HelpCircle className="h-5 w-5 shrink-0 group-hover:text-foreground" aria-hidden="true" />
              Support
            </div>
          </li>
        </ul>
      </nav>
    </div>
  )
}
