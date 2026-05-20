import { useEffect } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Timer } from "../components/Timer"
import { TimeLogList } from "../components/TimeLogList"
import { useTimeStore } from "../timeStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, DollarSign, Plus, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { TimeLogForm } from "../components/TimeLogForm"

export default function TimeTrackingPage() {
  const { fetchLogs, logs } = useTimeStore()
  const [isFormOpen, setIsFormOpen] = useState(false)

  useEffect(() => {
    fetchLogs()
  }, [])

  const totalMinutes = logs.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0)
  const billableMinutes = logs.filter(l => l.is_billable).reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0)
  const utilizationRate = totalMinutes > 0 ? Math.round((billableMinutes / totalMinutes) * 100) : 0
  
  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}m`
  }

  return (
    <PageWrapper 
      title="Time Tracking" 
      description="Monitor productivity and billable hours across your team."
      actions={
        <Button className="gap-2" onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4" />
          Log Manual Time
        </Button>
      }
    >
      <div className="space-y-8">
        <Timer />

        <div className="grid gap-6 sm:grid-cols-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tracked</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTime(totalMinutes)}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Billable Hours</CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatTime(billableMinutes)}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Estimated Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₹{(billableMinutes / 60 * 12000).toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Based on ₹12,000/hr average</p>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Utilization Rate</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{utilizationRate}%</div>
              <p className="text-[10px] text-muted-foreground mt-1">Billable / Total Time</p>
            </CardContent>
          </Card>
        </div>


        <div className="space-y-4">
          <h3 className="text-lg font-bold">Recent Logs</h3>
          <TimeLogList />
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Log Manual Time</DialogTitle>
            <DialogDescription>
              Enter historical time records for work already completed.
            </DialogDescription>
          </DialogHeader>
          <TimeLogForm onSuccess={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
