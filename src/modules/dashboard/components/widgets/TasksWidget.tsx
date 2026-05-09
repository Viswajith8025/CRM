import { CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { CheckCircle2, Clock } from 'lucide-react'
import { useTasksStore } from '@/modules/tasks'
import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'

export function TasksWidget() {
  const { tasks, fetchTasks } = useTasksStore()

  useEffect(() => {
    fetchTasks()
  }, [])

  const myTasks = tasks.slice(0, 5)

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
          Recent Tasks
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <div className="space-y-3">
          {myTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No tasks assigned.</p>
          ) : (
            myTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold truncate">{task.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{task.project?.name || 'No Project'}</p>
                </div>
                <Badge variant={task.status === 'done' ? 'default' : 'secondary'} className="text-[9px] h-4 px-1.5 uppercase font-black tracking-tighter shrink-0">
                  {task.status.replace('_', ' ')}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </div>
  )
}
