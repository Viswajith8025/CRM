import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '../types'
import { KanbanColumn } from './KanbanColumn'
import TaskCard from './TaskCard'
import { useTasksStore } from '../tasksStore'
import TaskDetailsDialog from './TaskDetailsDialog'
import TaskForm from './TaskForm'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from 'sonner'
import { useCallback } from 'react'

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
]

interface KanbanBoardProps {
  filterStatus?: string
  filterPriority?: string
  searchQuery?: string
}

export function KanbanBoard({ filterStatus = "all", filterPriority = "all", searchQuery = "" }: KanbanBoardProps) {
  const { tasks, updateTask, deleteTask } = useTasksStore()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null)
  
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const filteredTasks = useMemo(() => tasks.filter(task => {
    let matchesStatus = filterStatus === "all" || task.status === filterStatus
    
    if (filterStatus === "overdue") {
      matchesStatus = task.status !== 'done' && 
                      task.due_date !== null && 
                      new Date(task.due_date) < new Date()
    }

    const matchesPriority = filterPriority === "all" || task.priority === filterPriority
    
    const query = searchQuery.toLowerCase()
    const matchesSearch = query === "" || 
                          task.title.toLowerCase().includes(query) || 
                          (task.description && task.description.toLowerCase().includes(query))

    return matchesStatus && matchesPriority && matchesSearch
  }), [tasks, filterStatus, filterPriority, searchQuery])

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const task = tasks.find((t) => t.id === active.id)
    if (task) setActiveTask(task)
  }

  function handleDragOver(event: DragOverEvent) {
    // dnd-kit handles drag over visually
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)

    if (!over) return

    const activeId = active.id
    const overId = over.id

    const activeTask = tasks.find((t) => t.id === activeId)
    if (!activeTask) return

    // If dragging over a column
    const overColumn = COLUMNS.find(col => col.id === overId)
    if (overColumn && activeTask.status !== overColumn.id) {
      try {
        setSyncingTaskId(activeId as string)
        await updateTask(activeId as string, { status: overColumn.id })
      } finally {
        setSyncingTaskId(null)
      }
      return
    }

    // If dragging over another task
    const overTask = tasks.find(t => t.id === overId)
    if (overTask && activeTask.status !== overTask.status) {
      try {
        setSyncingTaskId(activeId as string)
        await updateTask(activeId as string, { status: overTask.status })
      } finally {
        setSyncingTaskId(null)
      }
    }
  }

  const handleOpenDetails = useCallback((task: Task) => {
    setSelectedTask(task)
    setIsDetailsOpen(true)
  }, [])

  const handleEdit = useCallback((task: Task) => {
    setSelectedTask(task)
    setIsEditOpen(true)
  }, [])

  const handleDeleteClick = useCallback((id: string) => {
    const task = tasks.find(t => t.id === id)
    if (task) {
      setSelectedTask(task)
      setIsDeleteAlertOpen(true)
    }
  }, [tasks])

  const confirmDelete = async () => {
    if (!selectedTask) return
    try {
      await deleteTask(selectedTask.id)
      toast.success("Task deleted")
      setIsDeleteAlertOpen(false)
    } catch (error) {
      toast.error("Failed to delete task")
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 h-full overflow-x-auto pb-6 [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-secondary/20 [&::-webkit-scrollbar-thumb]:bg-primary/20 hover:[&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
        {COLUMNS.filter(col => filterStatus === "all" || filterStatus === "overdue" || col.id === filterStatus).map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            tasks={filteredTasks.filter((t) => t.status === col.id)}
            syncingTaskId={syncingTaskId}
            onEdit={handleEdit}
            onDelete={handleDeleteClick}
            onOpenDetails={handleOpenDetails}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? (
          <TaskCard 
            task={activeTask} 
            isOverlay 
            onEdit={handleEdit} 
            onDelete={handleDeleteClick} 
            onOpenDetails={handleOpenDetails} 
          />
        ) : null}
      </DragOverlay>

      <TaskDetailsDialog 
        task={selectedTask} 
        open={isDetailsOpen} 
        onOpenChange={setIsDetailsOpen} 
      />

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
            <DialogDescription>
              Update the details of this task.
            </DialogDescription>
          </DialogHeader>
          {selectedTask && (
            <TaskForm task={selectedTask} onSuccess={() => setIsEditOpen(false)} />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTask?.title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-rose-500 hover:bg-rose-600 text-white">
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DndContext>
  )
}
