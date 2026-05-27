import { useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { 
  Users, 
  Briefcase, 
  CheckSquare, 
  Clock, 
  FileText, 
  DollarSign, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  UserCheck, 
  ShieldAlert,
  ArrowRight,
  Target,
  RefreshCw
} from "lucide-react"

const reportCategories = [
  {
    title: "HR & People",
    description: "Workforce analytics, attendance, and leave tracking.",
    reports: [
      { name: "Employee Directory", path: "/reports/employees", icon: Users },
      { name: "Attendance Logs", path: "/reports/attendance", icon: Clock },
      { name: "Leave Management", path: "/reports/leaves", icon: UserCheck },
    ]
  },
  {
    title: "Finance & Accounting",
    description: "Revenue tracking, expenses, and financial audits.",
    reports: [
      { name: "Income Report", path: "/reports/invoices", icon: TrendingUp },
      { name: "Expense Report", path: "/reports/expense", icon: TrendingDown },
      { name: "Payment Records", path: "/reports/payments", icon: CreditCard },
    ]
  },
  {
    title: "Operations & CRM",
    description: "Project progress, tasks, and sales pipeline.",
    reports: [
      { name: "Client Insights", path: "/reports/clients", icon: Users },
      { name: "Project Lifecycle", path: "/reports/projects", icon: Briefcase },
      { name: "Task Performance", path: "/reports/tasks", icon: CheckSquare },
      { name: "Asset Renewals", path: "/reports/renewals-audit", icon: RefreshCw },
      { name: "Sales Pipeline (Leads)", path: "/reports/leads", icon: Target },
    ]
  }
]

export default function ReportsPage() {
  const navigate = useNavigate()

  return (
    <PageWrapper 
      title="ERP Reporting Center" 
      description="Centralized access to professional enterprise reports and operational data audits."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        {reportCategories.map((category) => (
          <Card key={category.title} className="border-border/50 bg-card/30 shadow-none overflow-hidden">
            <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
              <CardTitle className="text-xl font-black tracking-tighter uppercase">{category.title}</CardTitle>
              <CardDescription className="font-medium">{category.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {category.reports.map((report) => (
                  <button
                    key={report.name}
                    onClick={() => navigate(report.path)}
                    className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-background border border-border/50 flex items-center justify-center group-hover:border-primary/30 group-hover:shadow-sm transition-all">
                        <report.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black tracking-tight">{report.name}</p>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Operational Report</p>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

    </PageWrapper>
  )
}



