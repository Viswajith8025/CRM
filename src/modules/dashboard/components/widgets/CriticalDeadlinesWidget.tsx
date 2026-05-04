import { CardHeader, CardContent } from '@/components/ui/card'
import { AlertCircle, Calendar } from 'lucide-react'
import { useTasksStore } from '@/modules/tasks/tasksStore'
import { useEffect, useMemo } from 'react'
import { format, isBefore, addDays } from 'date-fns'
import { cn } from '@/lib/utils'

export function CriticalDeadlinesWidget() {
  const { tasks, fetchTasks } = useTasksStore()

  useEffect(() => {
    fetchTasks()
  }, [])

  const criticalTasks = useMemo(() => {
    const today = new Date()
    const soon = addDays(today, 3)
    
    return tasks
      .filter(t => t.status !== 'done' && t.due_date && isBefore(new Date(t.due_date), soon))
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime())
      .slice(0, 4)
  }, [tasks])

  return (
    <div className="h-full flex flex-col bg-slate-950/20 rounded-xl border border-white/5">
      <CardHeader className="pb-4 pt-6 px-6">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/60 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-rose-500" />
          Critical Deadlines
        </h3>
      </CardHeader>
      <CardContent className="flex-1 px-6 pb-6">
        <div className="space-y-4">
          {criticalTasks.length === 0 ? (
            <p className="text-xs text-white/20 py-10 text-center uppercase tracking-widest font-black">All deadlines are stable</p>
          ) : (
            criticalTasks.map(task => {
              const isOverdue = isBefore(new Date(task.due_date!), new Date())
              return (
                <div key={task.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5 hover:border-rose-500/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{task.title}</p>
                    <p className="text-[10px] text-white/30 font-bold uppercase tracking-tight truncate">{task.project?.name || 'General'}</p>
                  </div>
                  <div className={cn(
                    "flex flex-col items-end px-2 py-1 rounded",
                    isOverdue ? "bg-rose-500/10" : "bg-amber-500/10"
                  )}>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-tighter",
                      isOverdue ? "text-rose-400" : "text-amber-400"
                    )}>
                      {isOverdue ? "OVERDUE" : format(new Date(task.due_date!), 'MMM d')}
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </CardContent>
    </div>
  )
}
