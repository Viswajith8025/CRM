import { useMemo, useEffect } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Briefcase, FileText, CheckCircle2, Clock, Loader2 } from "lucide-react"
import Grainient from "@/components/ui/Grainient"
import { useAuthStore } from "@/store/useAuthStore"
import { useProjectsStore } from "@/modules/projects"
import { useBillingStore } from "@/modules/billing"
import { Progress } from "@/components/ui/progress"
import { format } from "date-fns"

export default function ClientDashboard() {
  const { profile } = useAuthStore()
  const { projects, fetchProjects, isLoading: projectsLoading } = useProjectsStore()
  const { invoices, fetchInvoices, isLoading: billingLoading } = useBillingStore()

  useEffect(() => {
    fetchProjects()
    fetchInvoices()
  }, [])

  const clientData = useMemo(() => {
    // If the user is a client, we filter data to only show what belongs to them
    // This is reinforced by RLS on the server, but we filter here for UI clarity
    const myProjects = projects.filter(p => p.client_id === profile?.id || p.client?.email === profile?.email)
    const myInvoices = invoices.filter(inv => inv.client_id === profile?.id || inv.client?.email === profile?.email)
    
    const activeProjects = myProjects.filter(p => p.status === 'in_progress').length
    const unpaidInvoices = myInvoices.filter(inv => inv.status !== 'paid' && inv.status !== 'cancelled').length
    
    const totalTasks = myProjects.reduce((acc, p) => acc + (p.task_stats?.total || 0), 0)
    const completedTasks = myProjects.reduce((acc, p) => acc + (p.task_stats?.completed || 0), 0)
    
    return {
      myProjects,
      myInvoices,
      activeProjects,
      unpaidInvoices,
      totalTasks,
      completedTasks,
      taskRatio: totalTasks > 0 ? `${completedTasks}/${totalTasks}` : "0/0"
    }
  }, [projects, invoices, profile])

  if (projectsLoading || billingLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <PageWrapper 
      title={`Welcome back, ${profile?.full_name?.split(' ')[0] || 'User'}!`} 
      description="Track your project progress and view recent invoices."
    >
      {/* Decorative Background */}
      <div className="absolute top-0 right-0 w-[400px] h-[300px] -mr-20 -mt-20 opacity-20 pointer-events-none blur-3xl">
        <Grainient
          color1="#10b981"
          color2="#3b82f6"
          color3="#111111"
          timeSpeed={0.1}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
            <Briefcase className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientData.activeProjects}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
            <FileText className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientData.unpaidInvoices}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clientData.taskRatio}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Next Deadline</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {clientData.myProjects.length > 0 ? (
              <>
                <div className="text-sm font-bold truncate">{clientData.myProjects[0].name}</div>
                <p className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-tighter">
                  {clientData.myProjects[0].end_date ? format(new Date(clientData.myProjects[0].end_date), 'MMM d, yyyy') : 'No date set'}
                </p>
              </>
            ) : (
              <div className="text-xs text-muted-foreground italic">No upcoming deadlines</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Your Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientData.myProjects.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-4">No projects assigned yet.</div>
              ) : (
                clientData.myProjects.slice(0, 5).map(project => (
                  <div key={project.id} className="p-4 rounded-xl border bg-muted/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-bold">{project.name}</span>
                        <span className="text-[10px] uppercase font-black text-muted-foreground tracking-widest">{project.status}</span>
                      </div>
                      <span className="text-sm font-black text-primary">
                        {project.task_stats?.total ? Math.round((project.task_stats.completed / project.task_stats.total) * 100) : 0}%
                      </span>
                    </div>
                    <Progress value={project.task_stats?.total ? (project.task_stats.completed / project.task_stats.total) * 100 : 0} className="h-1.5" />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg">Recent Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clientData.myInvoices.length === 0 ? (
                <div className="text-sm text-muted-foreground italic py-4">No invoices found.</div>
              ) : (
                clientData.myInvoices.slice(0, 5).map(invoice => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{invoice.invoice_number}</span>
                      <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{invoice.status}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-black text-emerald-500">${Number(invoice.grand_total).toLocaleString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
