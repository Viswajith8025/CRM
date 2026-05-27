import { CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { CheckCircle2, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTasksQuery } from '@/modules/tasks/hooks/useTasksQuery'
import { Skeleton } from '@/components/ui/skeleton'

export function TasksWidget() {
  const { data, isLoading } = useTasksQuery()
  const myTasks = data?.pages.flat() || []

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
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : myTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No tasks assigned.</p>
          ) : (
            myTasks.slice(0, 5).map(task => (
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
