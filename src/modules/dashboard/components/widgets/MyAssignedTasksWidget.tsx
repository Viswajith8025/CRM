import { useEffect, useState } from "react"
import { useTasksStore } from "@/modules/tasks"
import { useAuthStore } from "@/store/useAuthStore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import {
  CheckCircle2, Circle, AlertCircle, Briefcase, Calendar,
  Flag, Layers, ArrowRight, Loader2, ListTodo, Play, Pause, Timer
} from "lucide-react"
import { format, isPast, isToday, startOfDay, endOfDay, addDays } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import type { Task } from "@/modules/tasks/types/types"
import { useTimeStore } from "@/modules/time-tracking/timeStore"
import { useTimeDeskStore } from "@/modules/time-tracking/timeDeskStore"

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

type Filter = "all" | "today" | "week" | "overdue"

function getDueDateDisplay(dueDate: string | null | undefined) {
  if (!dueDate) return null
  const d = new Date(dueDate)
  if (isPast(d) && !isToday(d)) {
    return <span className="text-[10px] font-bold text-rose-500 flex items-center gap-1"><AlertCircle className="h-2.5 w-2.5" />Overdue</span>
  }
  if (isToday(d)) {
    return <span className="text-[10px] font-bold text-amber-500">Due Today</span>
  }
  return <span className="text-[10px] text-muted-foreground">{format(d, "MMM d")}</span>
}

export function MyAssignedTasksWidget() {
  const { myTasks, myTasksLoading, fetchMyTasks, updateTask } = useTasksStore()
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>("all")
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  // Time Desk active shifts and timers
  const { activeTimer, startTimer, stopTimer } = useTimeStore()
  const { activeSession, checkIn } = useTimeDeskStore()
  const [timeTicker, setTimeTicker] = useState(0)

  useEffect(() => {
    if (profile?.id) fetchMyTasks()
  }, [profile?.id])

  // Periodic ticker to force render active timer durations
  useEffect(() => {
    let interval: any
    if (activeTimer) {
      interval = setInterval(() => {
        setTimeTicker(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [activeTimer])

  const getElapsedDuration = (startTime: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(startTime).getTime()) / 1000)
    if (diff < 0) return "00:00"
    const hrs = Math.floor(diff / 3600)
    const mins = Math.floor((diff % 3600) / 60)
    const secs = diff % 60
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartTaskTimer = async (task: Task) => {
    try {
      if (!activeSession) {
        toast.info("Clocking you into shift automatically...")
        await checkIn()
      }
      startTimer({
        task_id: task.id,
        start_time: new Date().toISOString(),
        description: `Working on task: ${task.title}`,
        is_billable: true
      })
      toast.success(`Timer started for "${task.title}"`)
    } catch (err: any) {
      toast.error(err.message || "Failed to start timer")
    }
  }

  const handleStopTaskTimer = async () => {
    try {
      await stopTimer()
      toast.success("Focus timer stopped and logged successfully!")
    } catch (err: any) {
      toast.error(err.message || "Failed to stop timer")
    }
  }

  const filtered = myTasks.filter(t => {
    const due = t.due_date ? new Date(t.due_date) : null
    if (filter === "today") return due && (isToday(due))
    if (filter === "week") return due && due <= addDays(new Date(), 7)
    if (filter === "overdue") return due && isPast(due) && !isToday(due)
    return true
  })

  const overdueCount = myTasks.filter(t => t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))).length

  const handleMarkDone = async (task: Task) => {
    setUpdatingId(task.id)
    try {
      // If we are currently timing this task, stop the timer first
      if (activeTimer && activeTimer.task_id === task.id) {
        await stopTimer()
      }
      await updateTask(task.id, { status: 'done' })
      // Intentionally NOT refetching here so the task stays on screen with a green tick
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

        {/* Filter tabs */}
        <Tabs value={filter} onValueChange={v => setFilter(v as Filter)} className="mt-3">
          <TabsList className="h-7 bg-background/60">
            <TabsTrigger value="all" className="text-[10px] h-6 px-2 font-bold uppercase">All ({myTasks.length})</TabsTrigger>
            <TabsTrigger value="today" className="text-[10px] h-6 px-2 font-bold uppercase">Today</TabsTrigger>
            <TabsTrigger value="week" className="text-[10px] h-6 px-2 font-bold uppercase">This Week</TabsTrigger>
            {overdueCount > 0 && (
              <TabsTrigger value="overdue" className="text-[10px] h-6 px-2 font-bold uppercase text-rose-500">
                Overdue ({overdueCount})
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto max-h-[400px]">
        {myTasksLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 h-full">
            <CheckCircle2 className="h-10 w-10 text-emerald-300" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
              {filter === "all" ? "No tasks assigned to you" : `No ${filter} tasks`}
            </p>
            {filter === "all" && (
              <p className="text-[10px] text-muted-foreground/60 text-center max-w-[200px]">
                Tasks assigned to you by your team lead will appear here.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/10">
            <AnimatePresence initial={false}>
              {filtered.map((task, i) => {
                const priority = PRIORITY_CONFIG[task.priority || "medium"]
                const status = STATUS_CONFIG[task.status || "todo"]
                const isCompleted = task.status === "completed" || task.status === "done"
                const isUpdating = updatingId === task.id
                const isTimerRunning = activeTimer?.task_id === task.id
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
                      isCompleted && "opacity-50",
                      isTimerRunning && "bg-sky-500/5 border-l-2 border-sky-500"
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

                          {/* Live Timer Running Badge */}
                          {isTimerRunning && activeTimer && (
                            <span className="flex items-center gap-1 text-[9px] font-bold text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded-full animate-pulse border border-sky-500/20">
                              <Timer className="h-2.5 w-2.5" />
                              {getElapsedDuration(activeTimer.start_time)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right Action buttons: Timer Control & Due date */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        {/* Task specific timer play/pause */}
                        {!isCompleted && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                            {isTimerRunning ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-full"
                                onClick={handleStopTaskTimer}
                                title="Pause focus timer"
                              >
                                <Pause className="h-3 w-3 fill-rose-500" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-sky-500 hover:text-sky-600 hover:bg-sky-500/10 rounded-full"
                                onClick={() => handleStartTaskTimer(task)}
                                disabled={activeTimer !== null} // Disable if another task is timing
                                title={activeTimer ? "Another timer is running" : "Start focus timer"}
                              >
                                <Play className="h-3 w-3 fill-sky-500" />
                              </Button>
                            )}
                          </div>
                        )}

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
      </CardContent>
    </Card>
  )
}

