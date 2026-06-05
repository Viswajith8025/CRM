import { useEffect, useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Camera, CheckCircle2, Circle, Clock, Trash2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { VideographyTaskForm } from "@/modules/tasks/components/VideographyTaskForm"
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
  remarks: string | null
}

export function VideographyWidget() {
  const { profile } = useAuthStore()
  const [loggedTasks, setLoggedTasks] = useState<LoggedTask[]>([])
  const [isLoading, setIsLoading] = useState(false)

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
    <Card className="bg-card border-border/40 shadow-sm overflow-hidden flex flex-col w-full">
      <CardHeader className="pb-4 border-b border-border/10 bg-primary/5 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-slate-800">
                Log Videography Work
              </CardTitle>
              <CardDescription className="text-[10px] font-bold text-slate-400 uppercase mt-1">
                Track your shoots and link them to clients.
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
          <VideographyTaskForm onSuccess={() => fetchLoggedTasks()} />
        </div>

        {/* Logged Tasks List */}
        <div className="flex-1 overflow-x-auto p-4 bg-slate-50/50">
          <h4 className="text-sm font-black uppercase tracking-widest text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-indigo-500" /> Recent Shoots
          </h4>

          {isLoading && loggedTasks.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground font-medium animate-pulse">
              Loading your logs...
            </div>
          ) : loggedTasks.length === 0 ? (
            <div className="text-center py-12 text-xs text-muted-foreground font-medium flex flex-col items-center gap-2 border-2 border-dashed border-slate-200 rounded-xl bg-white">
              <Camera className="h-8 w-8 text-slate-200" />
              <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                No videography work logged yet
              </span>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-border/40 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-muted/50 border-b border-border/40">
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-28">Date</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground min-w-[150px]">Description</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-40">Place & Time</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-40">Client Name</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-36">Status</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground w-32">Anchor</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground min-w-[150px]">Remarks</th>
                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right w-16">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {loggedTasks.map(task => {
                    const clientName = task.description?.match(/Client: ([^|]+)/)?.[1]?.trim() || ''
                    const placeTime = task.description?.match(/Place: ([^|]+)/)?.[1]?.trim() || ''
                    const anchor = task.description?.match(/Anchor: ([^|]+)/)?.[1]?.trim() || ''

                    return (
                      <tr key={task.id} className="group hover:bg-slate-50/50 transition-colors">
                        {/* Date */}
                        <td className="px-4 py-3">
                          <span className="text-xs font-bold text-slate-600">
                            {task.due_date ? new Date(task.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                          </span>
                        </td>

                        {/* Description */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {task.status === 'done' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : task.status === 'in_progress' ? (
                              <Clock className="h-4 w-4 text-amber-500 shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-slate-300 shrink-0" />
                            )}
                            <span className={cn(
                              "text-xs font-bold tracking-tight",
                              task.status === 'done' ? "text-slate-400 line-through" : "text-slate-800"
                            )}>
                              {task.title}
                            </span>
                          </div>
                        </td>

                        {/* Place & Time */}
                        <td className="px-4 py-3">
                          {placeTime ? (
                            <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded truncate max-w-[140px] inline-block">
                              {placeTime}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium italic">-</span>
                          )}
                        </td>

                        {/* Client Name */}
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 truncate max-w-[140px] inline-block">
                            {clientName || '-'}
                          </span>
                        </td>

                        {/* Status (Dropdown) */}
                        <td className="px-4 py-3">
                          <Select
                            value={
                              task.status === 'in_progress' ? 'ongoing' :
                              task.status === 'todo' ? 'pending' :
                              task.status
                            }
                            onValueChange={(val) => updateTaskStatus(task.id, val)}
                          >
                            <SelectTrigger className={cn(
                              "h-7 text-[10px] font-black uppercase tracking-wider px-3 rounded-md border-0 w-auto gap-2",
                              task.status === 'done' ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" :
                              task.status === 'in_progress' ? "bg-amber-100 text-amber-700 hover:bg-amber-200" :
                              "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            )}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="end">
                              <SelectItem value="pending" className="text-xs font-bold">Pending</SelectItem>
                              <SelectItem value="ongoing" className="text-xs font-bold">Ongoing</SelectItem>
                              <SelectItem value="done" className="text-xs font-bold">Done</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>

                        {/* Anchor */}
                        <td className="px-4 py-3">
                          {anchor ? (
                            <span className="text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded truncate max-w-[100px] inline-block">
                              {anchor}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium italic">-</span>
                          )}
                        </td>

                        {/* Remarks */}
                        <td className="px-4 py-3">
                          {task.remarks ? (
                            <span className="text-[10px] font-medium text-slate-500 italic truncate max-w-[200px] inline-block" title={task.remarks}>
                              "{task.remarks}"
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium italic">-</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete log"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
