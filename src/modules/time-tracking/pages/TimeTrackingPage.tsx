import { useEffect } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Timer } from "../components/Timer"
import { TimeLogList } from "../components/TimeLogList"
import { useTimeStore } from "../timeStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, TrendingUp, DollarSign } from "lucide-react"

export default function TimeTrackingPage() {
  const { fetchLogs, logs } = useTimeStore()

  useEffect(() => {
    fetchLogs()
  }, [])

  const totalMinutes = logs.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0)
  const billableMinutes = logs.filter(l => l.is_billable).reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0)
  
  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return `${h}h ${m}m`
  }

  return (
    <PageWrapper 
      title="Time Tracking" 
      description="Monitor productivity and billable hours across your team."
    >
      <div className="space-y-8">
        <Timer />

        <div className="grid gap-6 sm:grid-cols-3">
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
              <div className="text-2xl font-bold">${(billableMinutes / 60 * 150).toLocaleString()}</div>
              <p className="text-[10px] text-muted-foreground mt-1">Based on $150/hr average</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold">Recent Logs</h3>
          <TimeLogList />
        </div>
      </div>
    </PageWrapper>
  )
}
