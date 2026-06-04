import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Video, CheckCircle2, Circle, Clock, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VideoEditingTaskForm } from "@/modules/tasks/components/VideoEditingTaskForm"
import { useAuthStore } from "@/store/useAuthStore"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface LoggedTask {
  id: string
  title: string
  description: string | null
  status: string
  due_date: string | null
  created_at: string
}

export function VideoEditorWidget() {
  const { profile } = useAuthStore()
  const [loggedTasks, setLoggedTasks] = useState<LoggedTask[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchLoggedTasks = useCallback(async () => {
    if (!profile?.id) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, title, description, status, due_date, created_at')
        .eq('assigned_to', profile.id)
        .is('project_id', null)
        .ilike('description', 'Client:%')
        .is('deleted_at', null)
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
  }, [profile?.id])

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
            <div className="p-2 rounded-xl bg-orange-100 text-orange-600">
              <Video className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">
                Log Video Work
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                Track your video editing work and link it to a client.
              </CardDescription>
            </div>
          </div>
          <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-1 rounded-full">
            {loggedTasks.length} Logged
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
        {/* Input Form Section */}
        <div className="p-4 border-b border-border/10 shrink-0 bg-white">
          <VideoEditingTaskForm onSuccess={() => fetchLoggedTasks()} />
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
                <Video className="h-8 w-8 text-slate-200" />
                <span className="font-bold uppercase tracking-wider text-slate-300 text-[10px]">
                  No video work logged yet
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
                      <span className="text-[10px] font-semibold text-purple-500 mt-0.5 truncate">
                        {task.description?.replace('Client: ', '') || ''}
                      </span>
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
      </CardContent>
    </Card>
  )
}
