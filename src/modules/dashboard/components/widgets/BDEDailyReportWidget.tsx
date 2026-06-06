import { useState, useEffect } from "react"
import { useBDEReportStore } from "@/modules/bde/bdeReportStore"
import { useAuthStore } from "@/store/useAuthStore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Sun, Moon, CheckCircle2, History, Calendar } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"

export function BDEDailyReportWidget() {
  const { currentReport, fetchMyReportForToday, submitLoginForm, submitLogoutForm, isLoading } = useBDEReportStore()
  const { profile } = useAuthStore()

  const [loginData, setLoginData] = useState<any>({
    database_planned: "",
    database_count: "",
    leads_social_media: "",
    leads_just_dial: "",
    leads_other: "",
    meetings_scheduled: "",
  })

  const [logoutData, setLogoutData] = useState<any>({
    meetings_attended: "",
    calls_connected: "",
    amount_collected: "",
    remarks: "",
  })

  useEffect(() => {
    fetchMyReportForToday()
  }, [])

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...loginData,
        database_count: Number(loginData.database_count) || 0,
        leads_social_media: Number(loginData.leads_social_media) || 0,
        leads_just_dial: Number(loginData.leads_just_dial) || 0,
        leads_other: Number(loginData.leads_other) || 0,
        meetings_scheduled: Number(loginData.meetings_scheduled) || 0,
      }
      await submitLoginForm(payload)
      toast.success("Morning plan submitted successfully!")
    } catch (error) {
      // Error handled in store
    }
  }

  const handleLogoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        ...logoutData,
        meetings_attended: Number(logoutData.meetings_attended) || 0,
        calls_connected: Number(logoutData.calls_connected) || 0,
        amount_collected: Number(logoutData.amount_collected) || 0,
      }
      await submitLogoutForm(payload)
      toast.success("Evening report submitted successfully!")
    } catch (error) {
      // Error handled in store
    }
  }

  if (isLoading && !currentReport) {
    return <Card className="flex items-center justify-center p-8"><Loader2 className="animate-spin h-6 w-6 text-primary" /></Card>
  }

  const isCompleted = currentReport?.status === 'completed'

  return (
    <Card className="border-primary/20 shadow-lg relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
            {isCompleted ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : (currentReport ? <Moon className="h-5 w-5 text-indigo-400" /> : <Sun className="h-5 w-5 text-amber-500" />)}
            BDE Daily Report
          </CardTitle>
          <CardDescription>
            {format(new Date(), "EEEE, MMMM do, yyyy")} • {profile?.full_name || profile?.email}
          </CardDescription>
        </div>
        <BDEHistoryModal />
      </CardHeader>
      <CardContent>
        {isCompleted ? (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-6 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <h3 className="font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-tight">Great job today!</h3>
            <p className="text-sm text-emerald-600/80 dark:text-emerald-400/80">You have completed your daily report.</p>
          </div>
        ) : !currentReport ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-md mb-4 text-amber-600 dark:text-amber-400 text-sm font-medium">
              Please submit your Morning Plan before starting your calls.
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Database Planned (Set of leads)</Label>
              <Textarea
                required
                placeholder="E.g., Following up on web development inquiries from last week..."
                value={loginData.database_planned}
                onChange={e => setLoginData({ ...loginData, database_planned: e.target.value })}
                className="resize-none h-20 bg-muted/20"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Database Count</Label>
                <Input type="number" min="0" placeholder="0" required value={loginData.database_count} onChange={e => setLoginData({ ...loginData, database_count: e.target.value })} className="bg-muted/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Meetings Scheduled</Label>
                <Input type="number" min="0" placeholder="0" required value={loginData.meetings_scheduled} onChange={e => setLoginData({ ...loginData, meetings_scheduled: e.target.value })} className="bg-muted/20" />
              </div>
            </div>

            <div className="pt-2 border-t border-border/50">
              <Label className="text-xs uppercase font-bold text-muted-foreground mb-2 block">Leads Received Target</Label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Social Media</Label>
                  <Input type="number" min="0" placeholder="0" value={loginData.leads_social_media} onChange={e => setLoginData({ ...loginData, leads_social_media: e.target.value })} className="bg-muted/20 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Just Dial</Label>
                  <Input type="number" min="0" placeholder="0" value={loginData.leads_just_dial} onChange={e => setLoginData({ ...loginData, leads_just_dial: e.target.value })} className="bg-muted/20 h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Other Platforms</Label>
                  <Input type="number" min="0" placeholder="0" value={loginData.leads_other} onChange={e => setLoginData({ ...loginData, leads_other: e.target.value })} className="bg-muted/20 h-8" />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full font-black tracking-widest uppercase bg-amber-500 hover:bg-amber-600 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sun className="mr-2 h-4 w-4" />}
              Submit Log-in Plan
            </Button>
          </form>
        ) : (
          <form onSubmit={handleLogoutSubmit} className="space-y-4">
            <div className="bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-md mb-4 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
              Morning plan active. Please submit your Evening Report before logging out.
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Meetings Attended</Label>
                <Input type="number" min="0" placeholder="0" required value={logoutData.meetings_attended} onChange={e => setLogoutData({ ...logoutData, meetings_attended: e.target.value })} className="bg-muted/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Calls Connected</Label>
                <Input type="number" min="0" placeholder="0" required value={logoutData.calls_connected} onChange={e => setLogoutData({ ...logoutData, calls_connected: e.target.value })} className="bg-muted/20" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase font-bold text-muted-foreground">Amount Collected ($)</Label>
                <Input type="number" min="0" step="0.01" placeholder="0.00" required value={logoutData.amount_collected} onChange={e => setLogoutData({ ...logoutData, amount_collected: e.target.value })} className="bg-muted/20" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Daily Remarks</Label>
              <Textarea
                required
                placeholder="Summarize your day, challenges faced, major wins..."
                value={logoutData.remarks}
                onChange={e => setLogoutData({ ...logoutData, remarks: e.target.value })}
                className="resize-none h-32 bg-muted/20"
              />
            </div>

            <Button type="submit" className="w-full font-black tracking-widest uppercase bg-indigo-500 hover:bg-indigo-600 text-white" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Moon className="mr-2 h-4 w-4" />}
              Submit Evening Report
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function BDEHistoryModal() {
  const { reports, fetchMyReports, isLoading } = useBDEReportStore()
  const [isOpen, setIsOpen] = useState(false)

  // Basic date range filter
  const [days, setDays] = useState(7)

  useEffect(() => {
    if (isOpen) {
      const start = new Date()
      start.setDate(start.getDate() - days)
      fetchMyReports(start.toISOString().split('T')[0], new Date().toISOString().split('T')[0])
    }
  }, [isOpen, days])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-2 border-primary/20 hover:bg-primary/10">
          <History className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">History</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-widest flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            My Daily Reports History
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4 mt-2">
          <Button variant={days === 7 ? "default" : "outline"} size="sm" onClick={() => setDays(7)}>Last 7 Days</Button>
          <Button variant={days === 30 ? "default" : "outline"} size="sm" onClick={() => setDays(30)}>Last 30 Days</Button>
          <Button variant={days === 90 ? "default" : "outline"} size="sm" onClick={() => setDays(90)}>Last 90 Days</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : reports.length === 0 ? (
          <div className="text-center p-8 text-muted-foreground border rounded-lg bg-muted/10 border-dashed">No reports found for this period.</div>
        ) : (
          <div className="space-y-4">
            {reports.map((r) => (
              <Card key={r.id} className="overflow-hidden border-border/50">
                <div className={`h-1 w-full ${r.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <div className="p-4 flex flex-col md:flex-row gap-4">
                  <div className="md:w-1/4 border-r border-border/50 pr-4">
                    <h4 className="font-bold text-lg">{format(new Date(r.report_date), "MMM do, yyyy")}</h4>
                    <Badge variant={r.status === 'completed' ? "default" : "secondary"} className={r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30' : ''}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="flex-1 space-y-4 text-sm w-full">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Database Count</div>
                        <div className="font-medium">{r.database_count}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Meetings</div>
                        <div className="font-medium">{r.meetings_attended ?? '-'} / {r.meetings_scheduled}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Calls</div>
                        <div className="font-medium">{r.calls_connected ?? '-'}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Amount Collected</div>
                        <div className="font-medium text-emerald-500">${r.amount_collected ?? '-'}</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 p-3 bg-muted/10 rounded-md border border-border/50">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Social Media Leads</div>
                        <div className="font-medium">{r.leads_social_media}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Just Dial Leads</div>
                        <div className="font-medium">{r.leads_just_dial}</div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-muted-foreground">Other Platform Leads</div>
                        <div className="font-medium">{r.leads_other}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/50 bg-muted/5 border-t border-border/50 text-sm">
                  <div className="p-4">
                    <span className="font-black text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-500 block mb-1">Morning Plan: Database Planned</span>
                    <p className="text-muted-foreground">{r.database_planned || "No plan details provided."}</p>
                  </div>
                  <div className="p-4">
                    <span className="font-black text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block mb-1">Evening Report: Remarks</span>
                    <p className="text-muted-foreground">{r.remarks || "No remarks provided."}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
