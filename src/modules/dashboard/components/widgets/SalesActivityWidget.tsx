import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Phone, Calendar, MessageSquare, CheckCircle, Target, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { useDashboardEngine } from "@/modules/dashboard/dashboardEngineStore"
import { useAuthStore } from "@/store/useAuthStore"

export function SalesActivityWidget() {
  const [calls, setCalls] = useState('')
  const [meetings, setMeetings] = useState('')
  const [emails, setEmails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { profile } = useAuthStore()
  const { logPerformance } = useDashboardEngine()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!profile?.id) return
    
    setIsSubmitting(true)
    try {
      if (calls) await logPerformance(profile.id, 'calls_connected', parseInt(calls, 10))
      if (meetings) await logPerformance(profile.id, 'meetings_arranged', parseInt(meetings, 10))
      if (emails) await logPerformance(profile.id, 'emails_sent', parseInt(emails, 10))

      toast.success("Sales activity logged successfully for today!")
      setCalls('')
      setMeetings('')
      setEmails('')
    } catch (err: any) {
      toast.error(err.message || "Failed to log activity")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="bg-card/40 border-border/40 backdrop-blur-md shadow-sm overflow-hidden flex flex-col h-[400px] sm:h-[450px]">
      <CardHeader className="pb-4 border-b border-border/10 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-500" />
              Daily Sales Activity
            </CardTitle>
            <p className="text-[10px] text-muted-foreground/60 uppercase font-bold mt-1">Log your outbound efforts</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0">
        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Calls Connected</label>
                  <Input 
                    type="number" 
                    min="0"
                    placeholder="0" 
                    value={calls}
                    onChange={(e) => setCalls(e.target.value)}
                    className="font-bold bg-muted/20"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Meetings Arranged</label>
                  <Input 
                    type="number" 
                    min="0"
                    placeholder="0" 
                    value={meetings}
                    onChange={(e) => setMeetings(e.target.value)}
                    className="font-bold bg-muted/20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">WhatsApp / Emails Sent</label>
                  <Input 
                    type="number" 
                    min="0"
                    placeholder="0" 
                    value={emails}
                    onChange={(e) => setEmails(e.target.value)}
                    className="font-bold bg-muted/20"
                  />
                </div>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full font-black uppercase tracking-widest gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
              disabled={isSubmitting || (!calls && !meetings && !emails)}
            >
              {isSubmitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Logging...</>
              ) : (
                <><CheckCircle className="h-4 w-4" /> Log Daily Activity</>
              )}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
