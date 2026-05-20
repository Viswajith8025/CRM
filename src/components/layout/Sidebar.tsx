import { NavLink } from "react-router-dom"
import {
  LayoutDashboard,
  Users,
  Target,
  Briefcase,
  CheckSquare,
  BarChart3,
  Settings,
  Settings2,
  ShieldCheck,
  RefreshCw,
  Monitor,
  Users2,
  CreditCard,
  Calendar,
  UserCircle,
  FileBox,
  ShieldAlert,
  History,
  HelpCircle,
  Clock,
  ClipboardList,
  Building2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { useModuleRegistry } from "@/hooks/useModuleRegistry"

const IconRegistry: Record<string, any> = {
  LayoutDashboard,
  Users,
  Target,
  Briefcase,
  CheckSquare,
  BarChart3,
  Settings,
  Settings2,
  ShieldCheck,
  RefreshCw,
  Monitor,
  Users2,
  CreditCard,
  Calendar,
  UserCircle,
  FileBox,
  ShieldAlert,
  History,
  HelpCircle,
  Clock,
  ClipboardList,
  Building2
}

export function Sidebar() {
  const { top, bottom, isLoading } = useModuleRegistry()

  return (
    <div className="flex h-full flex-col gap-y-5 overflow-y-auto border-r border-border/40 bg-card pb-4">
      <div className="flex h-28 shrink-0 items-center justify-center border-b border-border/40 overflow-hidden">
        <img src="/ecraftzlogo.png" alt="eCraftz Logo" className="h-24 w-auto object-contain" />
      </div>
      
      <nav className="flex flex-1 flex-col px-6 mt-4">
        {isLoading ? (
          <div className="space-y-4 px-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-full bg-muted/20 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : (
          <ul role="list" className="flex flex-1 flex-col gap-y-7">
            {top.length === 0 && bottom.length === 0 ? (
              <li className="px-2 py-10 text-center">
                <ShieldAlert className="h-8 w-8 mx-auto text-muted-foreground/20 mb-2" />
                <p className="text-[10px] font-black uppercase text-muted-foreground/40 leading-tight">
                  No Modules Accessible
                </p>
              </li>
            ) : (
              <>
                {/* Top Section */}
                {top.length > 0 && (
                  <li>
                    <ul role="list" className="-mx-2 space-y-1.5">
                      {top.map((item) => {
                        const Icon = IconRegistry[item.icon] || LayoutDashboard
                        return (
                          <li key={item.name}>
                            <NavLink
                              to={item.route}
                              className={({ isActive }) => cn(
                                isActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                'group relative flex gap-x-3 rounded-xl p-3 text-sm font-bold leading-6 transition-all duration-200'
                              )}
                            >
                              {({ isActive }) => (
                                <>
                                  <Icon className={cn(
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
                        )
                      })}
                    </ul>
                  </li>
                )}

                {/* Bottom Section */}
                {bottom.length > 0 && (
                  <li className="mt-auto">
                    <ul role="list" className="-mx-2 space-y-1.5">
                      {bottom.map((item) => {
                        const Icon = IconRegistry[item.icon] || LayoutDashboard
                        return (
                          <li key={item.name}>
                            <NavLink
                              to={item.route}
                              className={({ isActive }) => cn(
                                isActive
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                                'group relative flex gap-x-3 rounded-xl p-3 text-sm font-bold leading-6 transition-all duration-200'
                              )}
                            >
                              {({ isActive }) => (
                                <>
                                  <Icon className={cn(
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
                        )
                      })}
                    </ul>
                  </li>
                )}
              </>
            )}
          </ul>
        )}
      </nav>
    </div>
  )
}
