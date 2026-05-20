import { memo, useState, useCallback, useMemo } from 'react'
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
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import type { Task, TaskStatus } from '../types/types'
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

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'review', title: 'Review' },
  { id: 'done', title: 'Done' },
]

interface KanbanBoardProps {
  tasks: Task[]
  filterStatus?: string
}

export const KanbanBoard = memo(({ tasks: filteredTasks, filterStatus = "all" }: KanbanBoardProps) => {
  const { tasks: allTasks, updateTask, deleteTask } = useTasksStore()
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

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const task = allTasks.find((t) => t.id === active.id)
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

    const activeTask = allTasks.find((t) => t.id === activeId)
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
    const overTask = allTasks.find(t => t.id === overId)
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
    const task = allTasks.find(t => t.id === id)
    if (task) {
      setSelectedTask(task)
      setIsDeleteAlertOpen(true)
    }
  }, [allTasks])

  const confirmDelete = async () => {
    if (!selectedTask) return
    try {
      await deleteTask(selectedTask.id)
      toast.success("Task deleted")
      setIsDeleteAlertOpen(false)
    } catch (error: any) {
      toast.error(error.message || "Failed to delete task")
    }
  }

  const groupedTasks = useMemo(() => {
    return COLUMNS.reduce((acc, col) => {
      acc[col.id] = filteredTasks.filter(t => t.status === col.id)
      return acc
    }, {} as Record<TaskStatus, Task[]>)
  }, [filteredTasks])

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
            tasks={groupedTasks[col.id] || []}
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
})
