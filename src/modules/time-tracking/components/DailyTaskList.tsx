import { useEffect, useState } from "react"
import { Plus, CheckCircle2, Circle, Trash2, ClipboardList, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDailyTasksStore } from "../dailyTasksStore"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import { useTheme } from "@/hooks/useTheme"

export function DailyTaskList() {
  const { theme } = useTheme()
  const { tasks, isLoading, fetchTasks, addTask, toggleTask, deleteTask } = useDailyTasksStore()
  const [newTitle, setNewTitle] = useState("")

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
    await addTask(newTitle.trim())
    setNewTitle("")
  }

  const pendingCount = tasks.filter(t => !t.is_completed).length

  return (
    <Card className="bg-card border-border/40 shadow-sm overflow-hidden flex flex-col h-full">
      <CardHeader className="pb-4 border-b border-border/10 bg-primary/5">
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
                Mandatory for shift checkout
              </p>
            </div>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-full border border-rose-100 animate-pulse">
              <AlertCircle className="h-3 w-3" />
              {pendingCount} PENDING
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col">
        <form onSubmit={handleAdd} className="p-4 flex gap-2 border-b border-border/10">
          <Input 
            placeholder="What are you tackling today?" 
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 border-border/40 focus-visible:ring-primary rounded-xl text-sm"
          />
          <Button type="submit" size="icon" className="bg-primary hover:bg-primary/90 rounded-xl shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
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
                    onClick={() => toggleTask(task.id, !task.is_completed)}
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
                  <span className={cn(
                    "text-sm font-bold tracking-tight",
                    task.is_completed ? "line-through text-slate-400" : "text-slate-700"
                  )}>
                    {task.title}
                  </span>
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
              <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">No tasks set for today</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
