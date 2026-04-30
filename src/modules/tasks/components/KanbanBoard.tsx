import { useState } from 'react'
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
import { TaskCard } from './TaskCard'
import { useTasksStore } from '../tasksStore'

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
  const { tasks, updateTask } = useTasksStore()
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null)

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

  const filteredTasks = tasks.filter(task => {
    const matchesStatus = filterStatus === "all" || task.status === filterStatus
    const matchesPriority = filterPriority === "all" || task.priority === filterPriority
    
    // Case-insensitive search on title and description
    const query = searchQuery.toLowerCase()
    const matchesSearch = query === "" || 
                          task.title.toLowerCase().includes(query) || 
                          (task.description && task.description.toLowerCase().includes(query))

    return matchesStatus && matchesPriority && matchesSearch
  })

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 h-full overflow-x-auto pb-4">
        {COLUMNS.filter(col => filterStatus === "all" || col.id === filterStatus).map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            tasks={filteredTasks.filter((t) => t.status === col.id)}
            syncingTaskId={syncingTaskId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
