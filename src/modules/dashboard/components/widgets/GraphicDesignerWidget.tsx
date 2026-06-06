import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Palette, CheckCircle2, Circle, Clock, Trash2, Calendar } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { GraphicDesignTaskForm } from "@/modules/tasks/components/GraphicDesignTaskForm"
import { useAuthStore } from "@/store/useAuthStore"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface LoggedTask {
  id: string
  title: string
  description: string | null
  status: string
  due_date: string | null
  created_at: string
  remarks: string | null
}

export function GraphicDesignerWidget() {
  const { profile } = useAuthStore()
  const [loggedTasks, setLoggedTasks] = useState<LoggedTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [isDayCompleted, setIsDayCompleted] = useState(() => {
    return localStorage.getItem(`day_completed_${profile?.id}_${new Date().toISOString().split('T')[0]}`) === 'true'
  })

  const handleCompleteDay = () => {
    const pending = loggedTasks.filter(t => t.status !== 'done')
    if (pending.length > 0) {
      if (!confirm(`You have ${pending.length} incomplete tasks. Are you sure you want to finish your day?`)) return
    }
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
    toast.success("Awesome work! You have completed all your tasks for today! 🎉", {
      duration: 5000,
      className: "bg-emerald-500 text-white border-none",
    });
  }


  const fetchLoggedTasks = useCallback(async () => {
    if (!profile?.id) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, status, due_date, created_at, remarks')
        .eq('assigned_to', profile.id)
        .is('project_id', null)
        .ilike('description', 'Client:%')
        .is('deleted_at', null)
        .eq('due_date', selectedDate)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!error && data) {
        setLoggedTasks(data as LoggedTask[])
      }
    } catch (e) {
      console.error("Failed to fetch logged tasks", e)
    } finally {
      setIsLoading(false)
    }
  }, [profile?.id, selectedDate])

  const updateTaskStatus = useCallback(async (taskId: string, newDisplayStatus: string) => {
    const dbStatus = newDisplayStatus === 'ongoing' ? 'in_progress' : newDisplayStatus === 'pending' ? 'todo' : 'done'
    // Optimistic update
    setLoggedTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: dbStatus } : t))
    const { error } = await supabase
      .from('tasks')
      .update({ status: dbStatus })
      .eq('id', taskId)
    if (error) {
      toast.error("Failed to update status")
      fetchLoggedTasks() // revert
    } else {
      toast.success("Status updated!")
    }
  }, [fetchLoggedTasks])

  const deleteTask = useCallback(async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this log?')) return
    // Optimistic update
    setLoggedTasks(prev => prev.filter(t => t.id !== taskId))
    const { error } = await supabase
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taskId)
    if (error) {
      toast.error("Failed to delete log")
      fetchLoggedTasks() // revert
    } else {
      toast.success("Log deleted")
    }
  }, [fetchLoggedTasks])

  useEffect(() => {
    fetchLoggedTasks()
  }, [fetchLoggedTasks])

  return (
    <Card className="bg-card border-border/40 shadow-sm overflow-hidden flex flex-col h-full max-h-[860px]">
      <CardHeader className="pb-4 border-b border-border/10 bg-primary/5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-100 text-pink-600">
              <Palette className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">
                Log Design Work
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                Track your graphic design work and link it to a client.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-7 pl-7 text-[10px] font-bold uppercase w-32 border-primary/20 bg-primary/5"
              />
            </div>
            {selectedDate !== new Date().toISOString().split('T')[0] && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="h-7 px-2 text-[10px] font-bold uppercase tracking-wider">
                Today
              </Button>
            )}
            <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full whitespace-nowrap hidden sm:inline-block">
              {loggedTasks.length} Logged
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
        {isDayCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-emerald-50/50 m-4 rounded-xl border border-emerald-100">
             <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-sm">
               <CheckCircle2 className="h-6 w-6 text-white" />
             </div>
             <h3 className="text-sm font-black tracking-widest uppercase text-emerald-600 mb-1">Great Job Today!</h3>
             <p className="text-[10px] font-bold text-emerald-600/70 uppercase">You have completed your daily report.</p>
             <Button variant="ghost" size="sm" onClick={() => { setIsDayCompleted(false); localStorage.removeItem(`day_completed_${profile?.id}_${new Date().toISOString().split('T')[0]}`) }} className="mt-6 text-[10px] font-bold uppercase text-emerald-600 hover:bg-emerald-100">Undo Completion</Button>
          </div>
        ) : (
          <>
        {/* Input Form Section */}
        <div className="p-4 border-b border-border/10 shrink-0 bg-white">
          <GraphicDesignTaskForm onSuccess={() => fetchLoggedTasks()} />
        </div>

        {/* Logged Tasks List */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">
            Recent Logs
          </h4>

          <div className="space-y-2">
            {isLoading && loggedTasks.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground font-medium animate-pulse">
                Loading your logs...
              </div>
            ) : loggedTasks.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground font-medium flex flex-col items-center gap-2">
                <Palette className="h-8 w-8 text-slate-200" />
                <span className="font-bold uppercase tracking-wider text-slate-300 text-[10px]">
                  No design work logged yet
                </span>
              </div>
            ) : (
              loggedTasks.map(task => (
                <div
                  key={task.id}
                  className="group flex items-start justify-between p-3 rounded-xl border bg-white border-slate-100 hover:border-purple-200 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    {task.status === 'done' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    ) : task.status === 'in_progress' ? (
                      <Clock className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className={cn(
                        "text-xs font-bold tracking-tight truncate",
                        task.status === 'done' ? "text-slate-400 line-through" : "text-slate-800"
                      )}>
                        {task.title}
                      </span>
                      <span className="text-[10px] font-semibold text-rose-500 mt-0.5 truncate">
                        {task.description?.replace('Client: ', '') || ''}
                      </span>
                      {task.remarks && (
                        <span className="text-[10px] font-medium text-slate-500 mt-0.5 italic truncate">
                          "{task.remarks}"
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={
                          task.status === 'in_progress' ? 'ongoing' :
                          task.status === 'todo' ? 'pending' :
                          task.status
                        }
                        onValueChange={(val) => updateTaskStatus(task.id, val)}
                      >
                        <SelectTrigger className={cn(
                          "h-6 text-[9px] font-black uppercase tracking-wider px-2 rounded border-0 w-auto gap-1",
                          task.status === 'done' ? "bg-green-100 text-green-700 hover:bg-green-200" :
                          task.status === 'in_progress' ? "bg-amber-100 text-amber-700 hover:bg-amber-200" :
                          "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="pending" className="text-xs font-bold">Pending</SelectItem>
                          <SelectItem value="ongoing" className="text-xs font-bold">Ongoing</SelectItem>
                          <SelectItem value="done" className="text-xs font-bold">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Delete entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {task.due_date && (
                      <span className="text-[9px] font-medium text-slate-400">
                        {new Date(task.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
                <div className="p-4 border-t border-border/10 shrink-0 bg-white">
              <Button onClick={handleCompleteDay} className="w-full bg-emerald-500 hover:bg-emerald-600 font-black uppercase tracking-widest text-[10px] gap-2 text-white">
                <CheckCircle2 className="h-4 w-4" />
                Complete Daily Work
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
