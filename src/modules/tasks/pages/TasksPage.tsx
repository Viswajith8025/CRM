import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Plus, Trello, List as ListIcon, Filter } from "lucide-react"
import { KanbanBoard } from "../components/KanbanBoard"
import { useTasksStore } from "../tasksStore"

export default function TasksPage() {
  const { fetchTasks, subscribeToTasks } = useTasksStore()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')

  useEffect(() => {
    fetchTasks()
    const unsubscribe = subscribeToTasks()
    return () => unsubscribe()
  }, [])

  return (
    <PageWrapper 
      title="Tasks" 
      description="Collaborate and track progress across all project tasks."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      }
    >
      <div className="flex items-center gap-2 bg-muted p-1 rounded-lg w-fit mb-8">
        <Button 
          variant={view === 'kanban' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => setView('kanban')}
          className="gap-2"
        >
          <Trello className="h-4 w-4" />
          Kanban
        </Button>
        <Button 
          variant={view === 'list' ? 'secondary' : 'ghost'} 
          size="sm" 
          onClick={() => setView('list')}
          className="gap-2"
        >
          <ListIcon className="h-4 w-4" />
          List
        </Button>
      </div>

      {view === 'kanban' ? (
        <KanbanBoard />
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
          Task List View coming soon
        </div>
      )}
    </PageWrapper>
  )
}
