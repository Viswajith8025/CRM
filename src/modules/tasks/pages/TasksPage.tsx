import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Plus, LayoutGrid, List as ListIcon, Filter, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { KanbanBoard } from "../components/KanbanBoard"
import { useTasksStore } from "../tasksStore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { TaskForm } from "../components/TaskForm"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function TasksPage() {
  const { fetchTasks, subscribeToTasks } = useTasksStore()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)

  useEffect(() => {
    fetchTasks()
    const unsubscribe = subscribeToTasks()
    return () => unsubscribe()
  }, [])

  const hasActiveFilters = statusFilter !== "all" || priorityFilter !== "all"

  const clearFilters = () => {
    setStatusFilter("all")
    setPriorityFilter("all")
  }

  return (
    <PageWrapper 
      title="Tasks" 
      description="Collaborate and track progress across all project tasks."
      actions={
        <div className="flex gap-2">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" className={cn("gap-2 font-bold", hasActiveFilters && "border-primary text-primary bg-primary/5")}>
                <Filter className="h-4 w-4" />
                Filter {hasActiveFilters && "•"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Filter Tasks</DialogTitle>
                <DialogDescription>
                  Apply advanced filters to view specific tasks.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Priority</Label>
                  <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Priorities" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button className="flex-1 font-bold" onClick={clearFilters} variant="outline">Clear All</Button>
                <DialogTrigger asChild>
                  <Button className="flex-1 font-bold">Show Results</Button>
                </DialogTrigger>
              </div>
            </DialogContent>
          </Dialog>

          <Button className="gap-2 font-bold" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      }
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 bg-muted p-1 rounded-lg w-fit shrink-0">
            <Button 
              variant={view === 'kanban' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setView('kanban')}
              className="gap-2 font-bold"
            >
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </Button>
            <Button 
              variant={view === 'list' ? 'secondary' : 'ghost'} 
              size="sm" 
              onClick={() => setView('list')}
              className="gap-2 font-bold"
            >
              <ListIcon className="h-4 w-4" />
              List
            </Button>
          </div>

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-background border border-border/50 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium shrink-0">
            Active filters applied
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-auto p-0 text-primary font-bold hover:bg-transparent">
              Reset
            </Button>
          </div>
        )}
      </div>

      {view === 'kanban' ? (
        <KanbanBoard 
          filterStatus={statusFilter} 
          filterPriority={priorityFilter} 
          searchQuery={searchQuery}
        />
      ) : (
        <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
          <div className="max-w-[250px] space-y-2">
            <p className="text-sm font-medium">Task List View</p>
            <p className="text-xs text-muted-foreground">The flat list view is being optimized for large datasets. Use the Kanban board for current task management.</p>
          </div>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>
              Add a new task to your workspace. You can optionally link it to a project.
            </DialogDescription>
          </DialogHeader>
          <TaskForm onSuccess={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
