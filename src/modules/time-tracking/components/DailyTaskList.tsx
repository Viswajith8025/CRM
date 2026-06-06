import { useEffect, useState } from "react"
import { Plus, CheckCircle2, Circle, Trash2, ClipboardList, AlertCircle, FileText, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDailyTasksStore } from "../dailyTasksStore"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useAuthStore } from "@/store/useAuthStore"
import { useTheme } from "@/hooks/useTheme"
import confetti from "canvas-confetti"
import { toast } from "sonner"

export function DailyTaskList() {
  const { theme } = useTheme()
  const { tasks, isLoading, fetchTasks, addTask, toggleTask, deleteTask, selectedDate, setSelectedDate } = useDailyTasksStore()
  const [newTitle, setNewTitle] = useState("")
  const [newNotes, setNewNotes] = useState("")
  const [targetDate, setTargetDate] = useState<'today' | 'tomorrow'>('today')
  const { profile } = useAuthStore()
  const [isDayCompleted, setIsDayCompleted] = useState(() => {
    return localStorage.getItem(`day_completed_${profile?.id}_${new Date().toISOString().split('T')[0]}`) === 'true'
  })

  useEffect(() => {
    fetchTasks()
    
    // Auto-refresh tasks if the day changes while keeping the tab open
    let lastDate = new Date().toDateString()
    const interval = setInterval(() => {
      const currentDate = new Date().toDateString()
      if (currentDate !== lastDate) {
        lastDate = currentDate
        fetchTasks()
      }
    }, 60000) // check every minute
    
    return () => clearInterval(interval)
  }, [])

  const handleAdd = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!newTitle.trim()) return
    await addTask(newTitle.trim(), newNotes.trim(), targetDate)
    setNewTitle("")
    setNewNotes("")
  }

  const handleToggle = async (taskId: string, isCompleted: boolean) => {
    await toggleTask(taskId, isCompleted)
    
    if (isCompleted) {
      const otherIncomplete = tasks.filter(t => t.id !== taskId && !t.is_completed)
      if (otherIncomplete.length === 0 && tasks.length > 0) {
        const duration = 3000
        const end = Date.now() + duration
        
        const frame = () => {
          confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#0ea5e9', '#10b981', '#f59e0b'] })
          confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#0ea5e9', '#10b981', '#f59e0b'] })

          if (Date.now() < end) requestAnimationFrame(frame)
        }
        frame()
        
        toast.success("Awesome work! You have completed all your daily focus tasks! 🎉", {
          duration: 5000,
          className: "bg-sky-500 text-white border-none",
        })
      }
    }
  }

  const handleCompleteDay = () => {
    const today = new Date().toISOString().split('T')[0]
    setIsDayCompleted(true)
    localStorage.setItem(`day_completed_${profile?.id}_${today}`, 'true')
    const duration = 3000;
    const end = Date.now() + duration;
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#0ea5e9', '#10b981', '#f59e0b'] });
      confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#0ea5e9', '#10b981', '#f59e0b'] });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
    toast.success("Awesome work! You have completed all your daily focus tasks! 🎉", {
      duration: 5000,
      className: "bg-sky-500 text-white border-none",
    });
  }

  const pendingCount = tasks.filter(t => !t.is_completed).length

  return (
    <Card className="bg-card border-border/40 shadow-sm overflow-hidden flex flex-col h-full">
      <CardHeader className="pb-4 border-b border-border/10 bg-primary/5">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-sky-100 text-sky-600">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">
                  Daily Work Focus
                </CardTitle>
                <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                  Self-Assigned Tasks & Notes
                </p>
              </div>
            </div>
            {pendingCount > 0 && selectedDate === 'today' && (
              <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-full border border-rose-100 animate-pulse">
                <AlertCircle className="h-3 w-3" />
                {pendingCount} PENDING
              </div>
            )}
          </div>
          
          <Tabs 
            value={selectedDate} 
            onValueChange={(v) => setSelectedDate(v as 'today' | 'tomorrow')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 bg-slate-200/50">
              <TabsTrigger value="today" className="text-xs font-bold uppercase tracking-wider">Today's Focus</TabsTrigger>
              <TabsTrigger value="tomorrow" className="text-xs font-bold uppercase tracking-wider">Tomorrow's Plan</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden relative">
        {isDayCompleted ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-sky-50/50 m-4 rounded-xl border border-sky-100">
             <div className="h-12 w-12 rounded-full bg-sky-500 flex items-center justify-center mb-4 shadow-sm">
               <CheckCircle2 className="h-6 w-6 text-white" />
             </div>
             <h3 className="text-sm font-black tracking-widest uppercase text-sky-600 mb-1">Great Job Today!</h3>
             <p className="text-[10px] font-bold text-sky-600/70 uppercase text-center">You have completed your daily focus.</p>
             <Button variant="ghost" size="sm" onClick={() => { setIsDayCompleted(false); localStorage.removeItem(`day_completed_${profile?.id}_${new Date().toISOString().split('T')[0]}`) }} className="mt-6 text-[10px] font-bold uppercase text-sky-600 hover:bg-sky-100">Undo Completion</Button>
          </div>
        ) : (
          <>
        <form onSubmit={handleAdd} className="p-4 flex flex-col gap-3 border-b border-border/10 bg-slate-50/50">
          <div className="flex items-start gap-2">
            <div className="flex-1 space-y-2">
              <Input 
                placeholder="What are you tackling?" 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="border-border/40 focus-visible:ring-primary rounded-xl text-sm h-10"
              />
              <Textarea
                placeholder="Optional remarks or notes..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="border-border/40 focus-visible:ring-primary rounded-xl text-xs min-h-[60px] resize-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Select value={targetDate} onValueChange={(v) => setTargetDate(v as 'today' | 'tomorrow')}>
              <SelectTrigger className="w-[140px] h-8 text-xs font-bold bg-white border-border/40 rounded-lg">
                <SelectValue placeholder="Target Date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-xs font-bold">For Today</SelectItem>
                <SelectItem value="tomorrow" className="text-xs font-bold">For Tomorrow</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="sm" className="bg-primary hover:bg-primary/90 rounded-lg shrink-0 gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" /> Add Task
            </Button>
          </div>
        </form>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[400px]">
          <AnimatePresence initial={false}>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className={cn(
                  "group flex items-center justify-between p-3 rounded-xl border transition-all",
                  task.is_completed 
                    ? "bg-slate-50 border-slate-100 opacity-60" 
                    : "bg-white border-sky-50 hover:border-sky-200 hover:shadow-sm"
                )}
              >
                <div className="flex items-center gap-3 flex-1">
                  <button 
                    onClick={() => handleToggle(task.id, !task.is_completed)}
                    className={cn(
                      "transition-colors",
                      task.is_completed ? "text-sky-500" : "text-slate-300 hover:text-sky-400"
                    )}
                  >
                    {task.is_completed ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  <div className="flex flex-col">
                    <span className={cn(
                      "text-sm font-bold tracking-tight",
                      task.is_completed ? "line-through text-slate-400" : "text-slate-700"
                    )}>
                      {task.title}
                    </span>
                    {task.notes && (
                      <span className={cn(
                        "text-[11px] font-medium mt-0.5 whitespace-pre-wrap flex items-start gap-1.5",
                        task.is_completed ? "text-slate-400" : "text-slate-500"
                      )}>
                        <FileText className="h-3 w-3 shrink-0 mt-[2px] opacity-70" />
                        {task.notes}
                      </span>
                    )}
                  </div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => deleteTask(task.id)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all rounded-lg h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>

          {tasks.length === 0 && !isLoading && (
            <div className="py-10 text-center flex flex-col items-center">
              <ClipboardList className="h-10 w-10 text-slate-100 mb-2" />
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">
                No tasks set for {selectedDate}
              </p>
            </div>
          )}
        </div>
            <div className="p-4 border-t border-border/10 shrink-0 bg-white sticky bottom-0 z-10">
              <Button onClick={handleCompleteDay} className="w-full bg-sky-500 hover:bg-sky-600 font-black uppercase tracking-widest text-[10px] gap-2 text-white">
                <CheckCircle2 className="h-4 w-4" />
                Complete Daily Focus
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
