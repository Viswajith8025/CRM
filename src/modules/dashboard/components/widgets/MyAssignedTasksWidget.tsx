import { useState } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  CheckCircle2, Circle, Briefcase, Calendar,
  ArrowRight, Loader2, ListTodo
} from "lucide-react"
import { format, isPast, isToday } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import confetti from "canvas-confetti"
import type { Task } from "@/modules/tasks/types/types"

import { useMyTasksQuery } from '@/modules/tasks/hooks/useTasksQuery'
import { useTasksStore } from "@/modules/tasks"

const PRIORITY_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  urgent: { label: "Urgent", cls: "bg-rose-500/10 text-rose-500 border-rose-500/20", dot: "bg-rose-500" },
  high:   { label: "High",   cls: "bg-orange-500/10 text-orange-500 border-orange-500/20", dot: "bg-orange-500" },
  medium: { label: "Medium", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20",   dot: "bg-amber-500" },
  low:    { label: "Low",    cls: "bg-slate-500/10 text-slate-400 border-slate-300/20",    dot: "bg-slate-400" },
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  todo:        { label: "To Do",       cls: "bg-slate-500/10 text-slate-400" },
  in_progress: { label: "In Progress", cls: "bg-sky-500/10 text-sky-500" },
  review:      { label: "Review",      cls: "bg-violet-500/10 text-violet-500" },
  blocked:     { label: "Blocked",     cls: "bg-rose-500/10 text-rose-500" },
  completed:   { label: "Completed",   cls: "bg-emerald-500/10 text-emerald-500" },
  done:        { label: "Done",        cls: "bg-emerald-500/10 text-emerald-500" },
}

function getDueDateDisplay(dueDate: string | null | undefined) {
  if (!dueDate) return null
  const d = new Date(dueDate)
  if (isPast(d) && !isToday(d)) {
    return <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1">Overdue</span>
  }
  if (isToday(d)) {
    return <span className="text-[10px] font-bold text-amber-500">Due Today</span>
  }
  return <span className="text-[10px] text-muted-foreground">{format(d, "MMM d")}</span>
}

export function MyAssignedTasksWidget() {
  const { data: myTasks = [], isLoading: myTasksLoading } = useMyTasksQuery()
  const { updateTask } = useTasksStore()
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  
  const [isDayCompleted, setIsDayCompleted] = useState(() => {
    return localStorage.getItem(`day_completed_${profile?.id}_${new Date().toISOString().split('T')[0]}`) === 'true'
  })

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
    toast.success("Awesome work! You have completed all your tasks for today! 🎉", { className: "bg-emerald-500 text-white border-none" });
  }

  const filtered = myTasks.filter(t => {
    if (!selectedDate) return true;
    const due = t.due_date ? new Date(t.due_date).toISOString().split('T')[0] : null;
    const created = t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : null;
    const updated = t.updated_at ? new Date(t.updated_at).toISOString().split('T')[0] : null;
    
    if (due === selectedDate) return true;
    if (created === selectedDate) return true;
    if ((t.status === 'done' || t.status === 'completed') && updated === selectedDate) return true;
    
    return false;
  })

  const overdueCount = myTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length

  const handleMarkDone = async (task: Task) => {
    setUpdatingId(task.id)
    try {
      await updateTask(task.id, { status: 'done' })
      toast.success(`"${task.title}" completed!`)
    } catch (err: any) {
      toast.error(err.message || "Failed to complete task")
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <Card className="bg-card border-border/40 shadow-sm overflow-hidden h-full flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3 border-b border-border/10 bg-gradient-to-r from-primary/5 to-violet-500/5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10">
              <ListTodo className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">My Assigned Tasks</h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5">
                {myTasks.length} active · {overdueCount > 0 && (
                  <span className="text-rose-500">{overdueCount} overdue</span>
                )}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-[10px] gap-1 font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-all"
            onClick={() => navigate("/tasks")}
          >
            All Tasks <ArrowRight className="h-3 w-3" />
          </Button>
        </div>

        {/* History Date Picker */}
        <div className="mt-3 flex items-center gap-2">
           <div className="relative flex-1">
             <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
             <Input 
               type="date" 
               value={selectedDate}
               onChange={(e) => setSelectedDate(e.target.value)}
               className="h-8 pl-8 text-xs font-bold bg-background/60 border-primary/20"
             />
           </div>
           {selectedDate !== new Date().toISOString().split('T')[0] && (
             <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])} className="h-8 text-[10px] font-bold uppercase tracking-wider">
               Today
             </Button>
           )}
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto max-h-[400px] flex flex-col relative">
        {isDayCompleted ? (
           <div className="flex-1 flex flex-col items-center justify-center p-6 bg-emerald-50/50 m-4 rounded-xl border border-emerald-100">
             <div className="h-12 w-12 rounded-full bg-emerald-500 flex items-center justify-center mb-4 shadow-sm">
               <CheckCircle2 className="h-6 w-6 text-white" />
             </div>
             <h3 className="text-sm font-black tracking-widest uppercase text-emerald-600 mb-1">Great Job Today!</h3>
             <p className="text-[10px] font-bold text-emerald-600/70 uppercase text-center">You have completed your daily report.</p>
             <Button variant="ghost" size="sm" onClick={() => { setIsDayCompleted(false); localStorage.removeItem(`day_completed_${profile?.id}_${new Date().toISOString().split('T')[0]}`) }} className="mt-6 text-[10px] font-bold uppercase text-emerald-600 hover:bg-emerald-100">Undo Completion</Button>
          </div>
        ) : (
          <>
        {myTasksLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 h-full">
            <CheckCircle2 className="h-10 w-10 text-emerald-300" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {`No tasks found for ${selectedDate}`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            <AnimatePresence initial={false}>
              {filtered.map((task, i) => {
                const priority = PRIORITY_CONFIG[task.priority || "medium"]
                const status = STATUS_CONFIG[task.status || "todo"]
                const isCompleted = task.status === "completed" || task.status === "done"
                const isUpdating = updatingId === task.id
                const taskAny = task as any

                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn(
                      "flex items-start justify-between gap-3 p-3.5 hover:bg-muted/30 transition-all group",
                      isCompleted && "opacity-50"
                    )}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      {/* Mark done button */}
                      <button
                        onClick={() => !isCompleted && handleMarkDone(task)}
                        disabled={isCompleted || isUpdating}
                        className={cn(
                          "mt-0.5 flex-shrink-0 transition-colors rounded-full",
                          isCompleted ? "text-emerald-500 cursor-default" : "text-muted-foreground hover:text-emerald-500"
                        )}
                      >
                        {isUpdating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : isCompleted ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>

                      {/* Task content */}
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-xs font-bold leading-snug break-words", isCompleted && "line-through text-muted-foreground")}>
                          {task.title}
                        </p>

                        {/* Meta row */}
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {/* Project */}
                          {taskAny.project?.name && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                              <Briefcase className="h-2.5 w-2.5" />
                              {taskAny.project.name}
                            </span>
                          )}

                          {/* Module */}
                          {taskAny.module?.name && (
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                              <span className="h-1.5 w-1.5 rounded-full inline-block" style={{ backgroundColor: taskAny.module.color || '#6366f1' }} />
                              {taskAny.module.name}
                            </span>
                          )}

                          {/* Priority badge */}
                          <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", priority.cls)}>
                            <span className={cn("h-1.5 w-1.5 rounded-full mr-1 inline-block", priority.dot)} />
                            {priority.label}
                          </Badge>

                          {/* Status badge */}
                          <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", status.cls)}>
                            {status.label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Right Action buttons */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {getDueDateDisplay(task.due_date)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
        <div className="p-4 border-t border-border/10 shrink-0 bg-white sticky bottom-0 z-10">
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
