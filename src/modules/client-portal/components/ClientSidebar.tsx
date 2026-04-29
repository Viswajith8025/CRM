import { NavLink } from "react-router-dom"
import { 
  LayoutDashboard, 
  Briefcase, 
  FileText, 
  Settings,
  HelpCircle
} from "lucide-react"
import { cn } from "@/lib/utils"

const navigation = [
  { name: 'Overview', href: '/portal', icon: LayoutDashboard },
  { name: 'My Projects', href: '/portal/projects', icon: Briefcase },
  { name: 'Invoices', href: '/portal/invoices', icon: FileText },
  { name: 'Settings', href: '/portal/settings', icon: Settings },
  { name: 'Support', href: '/portal/support', icon: HelpCircle },
]

export function ClientSidebar() {
  return (
    <div className="flex h-full flex-col gap-y-5 overflow-y-auto border-r border-border bg-card px-6 pb-4">
      <div className="flex h-16 shrink-0 items-center">
        <span className="text-xl font-bold text-primary">
          CLIENT PORTAL
        </span>
      </div>
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => (
                <li key={item.name}>
                  <NavLink
                    to={item.href}
                    className={({ isActive }) => cn(
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-all'
                    )}
                  >
                    <item.icon className="h-6 w-6 shrink-0" aria-hidden="true" />
                    {item.name}
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
