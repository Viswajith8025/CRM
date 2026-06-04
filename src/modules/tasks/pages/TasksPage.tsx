import { useEffect, useState, useMemo } from "react"
import { usePerfGuard } from '@/hooks/usePerfGuard'
import { useDebounce } from "@/hooks/useDebounce"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Plus, LayoutGrid, List as ListIcon, Filter, Search, FileSpreadsheet, Users } from "lucide-react"
import { ImportWizard } from "@/components/shared/ImportWizard"
import { Button } from "@/components/ui/button"
import { KanbanBoard } from "../components/KanbanBoard"
import { TaskList } from "../components/TaskList"
import { WorkloadBoard } from "../components/WorkloadBoard"
import { useTasksStore } from "../tasksStore"
import { useTeamStore } from "@/modules/admin"
import { useTasksQuery, taskKeys } from "../hooks/useTasksQuery"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import TaskForm from "../components/TaskForm"
import { ContentWritingTaskForm } from "../components/ContentWritingTaskForm"
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

import { useSearchParams } from "react-router-dom"
import { useAuthStore } from "@/store/useAuthStore"
import { useQueryClient } from "@tanstack/react-query"

export default function TasksPage() {
  usePerfGuard('TasksPage')
  const { profile } = useAuthStore()
  // BUG-004 FIX: Need queryClient to invalidate cache after import instead of full page reload
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [view, setView] = useState<'kanban' | 'list' | 'workload'>('kanban')
  const [statusFilter, setStatusFilter] = useState("all")
  const [priorityFilter, setPriorityFilter] = useState("all")
  const [sortBy, setSortBy] = useState("created_at")
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>("desc")
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "")
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  const { members, fetchMembers } = useTeamStore()
  useEffect(() => {
    fetchMembers()
  }, [])
  const currentUserMember = members.find(m => m.id === profile?.id)
  const isContentWriter = profile?.role === 'employee' && currentUserMember?.department?.toLowerCase().includes('content')

  // BUG-001 FIX: Pass debouncedSearchQuery as the 4th argument so backend search is triggered
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useTasksQuery(
    undefined, 
    false, 
    statusFilter, 
    debouncedSearchQuery,
    sortBy,
    sortOrder
  )
  const tasks = data?.pages.flat() || []

  useEffect(() => {
    // Update local search if URL changes
    const urlSearch = searchParams.get("search")
    if (urlSearch && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch)
    }
  }, [searchParams])

  const hasActiveFilters = statusFilter !== "all" || priorityFilter !== "all" || sortBy !== "created_at" || sortOrder !== "desc"

  const clearFilters = () => {
    setStatusFilter("all")
    setPriorityFilter("all")
    setSortBy("created_at")
    setSortOrder("desc")
  }

  // BUG-004 FIX: Invalidate query cache after import completes instead of blowing away the entire app state
  const handleImportComplete = () => {
    setIsImportOpen(false)
    queryClient.invalidateQueries({ queryKey: taskKeys.all })
    toast.success("Import complete. Tasks refreshed.")
  }

  return (
    <PageWrapper 
      title="Tasks" 
      description="Collaborate and track progress across all project tasks."
      actions={
        <div className="flex gap-2">
          {profile?.role !== 'employee' && (
            <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5" onClick={() => setIsImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              Bulk Import
            </Button>
          )}
          <Button className="gap-2 font-bold" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      }
    >
      {/* BUG-004 FIX: onComplete now invalidates cache properly instead of window.location.reload() */}
      <ImportWizard 
        module="tasks" 
        open={isImportOpen} 
        onOpenChange={setIsImportOpen} 
        onComplete={handleImportComplete}
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
            {profile?.role !== 'employee' && (
              <Button 
                variant={view === 'workload' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setView('workload')}
                className="gap-2 font-bold"
              >
                <Users className="h-4 w-4" />
                Workload
              </Button>
            )}
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
          
          {/* Sorting Dropdowns */}
          {view === 'list' && (
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(val) => setSortBy(val)}>
                <SelectTrigger className="w-[140px] h-9 text-xs font-medium">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at">Date Created</SelectItem>
                  <SelectItem value="due_date">Due Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 px-3 text-xs font-bold"
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
              >
                {sortOrder === 'desc' ? 'Desc ↓' : 'Asc ↑'}
              </Button>
            </div>
          )}
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

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading tasks...
        </div>
      ) : view === 'workload' ? (
        <WorkloadBoard />
      ) : view === 'kanban' ? (
        <KanbanBoard 
          tasks={tasks}
          filterStatus={statusFilter}
        />
      ) : (
        <TaskList 
          tasks={tasks}
        />
      )}

      {hasNextPage && view !== 'kanban' && (
        <div className="flex justify-center mt-6">
          <Button 
            variant="outline" 
            onClick={() => fetchNextPage()} 
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading more..." : "Load More Tasks"}
          </Button>
        </div>
      )}

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isContentWriter ? "Log Content Work" : "Create New Task"}</DialogTitle>
            <DialogDescription>
              {isContentWriter ? "Track your content writing work and link it to a client." : "Add a new task to your workspace. You can optionally link it to a project."}
            </DialogDescription>
          </DialogHeader>
          {isContentWriter ? (
            <ContentWritingTaskForm onSuccess={() => setIsFormOpen(false)} />
          ) : (
            <TaskForm onSuccess={() => setIsFormOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
