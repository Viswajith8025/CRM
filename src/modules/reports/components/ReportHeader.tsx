import { Button } from "@/components/ui/button"
import { Download, Printer, Search, MapPin, ChevronDown, FileSpreadsheet, FileText } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useNavigate, useLocation } from "react-router-dom"

interface ReportHeaderProps {
  title: string
  description: string
  onExportCSV?: () => void
  onExportPDF?: () => void
  onPrint?: () => void
}

const secondaryNav = [
  { name: "CRM Analytics", path: "/reports/crm" },
  { name: "Project Audit", path: "/reports/projects" },
  { name: "Billing Reports", path: "/reports/billing" },
  { name: "Attendance Logs", path: "/reports/attendance" },
  { name: "Invoice Audit", path: "/reports/invoices" },
  { name: "Task Performance", path: "/reports/tasks" },
  { name: "Audit Trail", path: "/reports/audit" },
]

export function ReportHeader({
  title,
  description,
  onExportCSV,
  onExportPDF,
  onPrint
}: ReportHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <div className="flex flex-col border-b border-border/50 bg-card">
      {/* TOP HEADER: SEARCH & BRANCH */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border/50 bg-muted/20">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search..." 
            className="h-8 pl-8 bg-background border-none shadow-none text-xs" 
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-background text-[11px] font-bold cursor-pointer hover:bg-muted/50 transition-colors">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            Calicut (Main)
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-black text-xs">
            V
          </div>
        </div>
      </div>

      {/* SECONDARY NAV: TABS */}
      <div className="flex items-center px-6 bg-background overflow-x-auto no-scrollbar">
        {secondaryNav.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.name}
              onClick={() => navigate(item.path)}
              className={cn(
                "px-4 py-3 text-[11px] font-bold whitespace-nowrap transition-all border-b-2",
                isActive 
                  ? "text-primary border-primary bg-primary/5" 
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/30"
              )}
            >
              {item.name}
            </button>
          )
        })}
      </div>

      {/* TITLE & ACTIONS */}
      <div className="flex items-center justify-between px-8 py-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground uppercase">{title}</h1>
          <p className="text-xs text-muted-foreground font-medium mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onPrint} className="h-9 gap-2 font-bold text-xs uppercase border-border/50">
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-9 gap-2 font-black text-xs uppercase shadow-sm">
                <Download className="h-3.5 w-3.5" />
                Export Data
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={onExportCSV} className="gap-2 py-3 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-bold">Export CSV</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExportPDF} className="gap-2 py-3 cursor-pointer">
                <FileText className="h-4 w-4 text-rose-500" />
                <span className="text-xs font-bold">Export PDF</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
