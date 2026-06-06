import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { useDashboardEngine } from "@/modules/dashboard/dashboardEngineStore"
import { useAuthStore } from "@/store/useAuthStore"
import { Target, Phone, Calendar, MessageSquare, Loader2, CheckCircle } from "lucide-react"

export function SalesActivityWidget() {
  const [calls, setCalls] = useState('')
  const [meetings, setMeetings] = useState('')
  const [emails, setEmails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { profile } = useAuthStore()
  const [isDayCompleted, setIsDayCompleted] = useState(() => {
    return localStorage.getItem(`day_completed_${profile?.id}_${new Date().toISOString().split('T')[0]}`) === 'true'
  })

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

  const handleCompleteDay = () => {
    const today = new Date().toISOString().split('T')[0]
    setIsDayCompleted(true)
    localStorage.setItem(`day_completed_${profile?.id}_${today}`, 'true')
    
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#10b981', '#3b82f6', '#8b5cf6'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#10b981', '#3b82f6', '#8b5cf6'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    toast.success("Awesome work! You have completed your daily sales activity! 🎉", {
      duration: 5000,
      className: "bg-emerald-500 text-white border-none",
    });
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
      <CardContent className="flex-1 overflow-y-auto p-0 flex flex-col">
        {isDayCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-emerald-50/50 m-4 rounded-xl border border-emerald-100">
             <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-sm">
               <CheckCircle className="h-6 w-6 text-white" />
             </div>
             <h3 className="text-sm font-black tracking-widest uppercase text-emerald-600 mb-1">Great Job Today!</h3>
             <p className="text-[10px] font-bold text-emerald-600/70 uppercase text-center">You have completed your daily report.</p>
             <Button variant="ghost" size="sm" onClick={() => { setIsDayCompleted(false); localStorage.removeItem(`day_completed_${profile?.id}_${new Date().toISOString().split('T')[0]}`) }} className="mt-6 text-[10px] font-bold uppercase text-emerald-600 hover:bg-emerald-100">Undo Completion</Button>
          </div>
        ) : (
          <>
            <div className="p-6 flex-1">
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
                    <><CheckCircle className="h-4 w-4" /> Log Current Activity</>
                  )}
                </Button>
              </form>
            </div>
            
            <div className="p-4 border-t border-border/10 shrink-0 bg-white">
              <Button onClick={handleCompleteDay} className="w-full bg-emerald-500 hover:bg-emerald-600 font-black uppercase tracking-widest text-[10px] gap-2 text-white">
                <CheckCircle className="h-4 w-4" />
                Complete Daily Work
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
