import { useEffect, useState, useMemo } from "react"
import { usePerfGuard } from '@/hooks/usePerfGuard'
import { useDebounce } from "@/hooks/useDebounce"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Plus, LayoutGrid, List as ListIcon, Filter, Search, FileSpreadsheet } from "lucide-react"
import { ImportWizard } from "@/components/shared/ImportWizard"
import { Button } from "@/components/ui/button"
import { KanbanBoard } from "../components/KanbanBoard"
import { TaskList } from "../components/TaskList"
import { useTasksStore } from "../tasksStore"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import TaskForm from "../components/TaskForm"
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
  usePerfGuard('TasksPage')
  const { tasks, fetchTasks, subscribeToTasks } = useTasksStore()
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [isFormOpen, setIsFormOpen] = useState(false)

  const [isImportOpen, setIsImportOpen] = useState(false)

  useEffect(() => {
    fetchTasks()
    const unsubscribe = subscribeToTasks()
    return () => unsubscribe()
  }, [])

  const filteredTasks = useMemo(() => tasks.filter(task => {
    let matchesStatus = statusFilter === "all" || task.status === statusFilter
    
    if (statusFilter === "overdue") {
      matchesStatus = task.status !== 'done' && 
                      task.due_date !== null && 
                      new Date(task.due_date) < new Date()
    }

    const matchesPriority = priorityFilter === "all" || task.priority === priorityFilter
    
    const query = debouncedSearchQuery.toLowerCase()
    const matchesSearch = query === "" || 
                          task.title.toLowerCase().includes(query) || 
                          (task.description && task.description.toLowerCase().includes(query))

    return matchesStatus && matchesPriority && matchesSearch
  }), [tasks, statusFilter, priorityFilter, debouncedSearchQuery])

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
          <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5" onClick={() => setIsImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            Bulk Import
          </Button>
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
                <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold tracking-tight">Overdue Only</Label>
                    <p className="text-[10px] text-muted-foreground">Show only tasks past their deadline</p>
                  </div>
                  <Button 
                    variant={statusFilter === "overdue" ? "default" : "outline"}
                    size="sm"
                    className="font-black text-[10px]"
                    onClick={() => setStatusFilter(statusFilter === "overdue" ? "all" : "overdue")}
                  >
                    {statusFilter === "overdue" ? "ACTIVE" : "ENABLE"}
                  </Button>
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
      <ImportWizard 
        module="tasks" 
        open={isImportOpen} 
        onOpenChange={setIsImportOpen} 
        onComplete={() => fetchTasks()} 
      />
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
          tasks={filteredTasks}
          filterStatus={statusFilter}
        />
      ) : (
        <TaskList 
          tasks={filteredTasks}
        />
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
