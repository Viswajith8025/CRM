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
import type { Project, ProjectStatus } from '../types'
import { KanbanColumn } from './KanbanColumn'
import ProjectCard from './ProjectCard'
import { useProjectsStore } from '../projectsStore'

const COLUMNS: { id: ProjectStatus; title: string }[] = [
  { id: 'planning', title: 'Planning' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'on_hold', title: 'On Hold' },
  { id: 'completed', title: 'Completed' },
  { id: 'cancelled', title: 'Cancelled' },
]

interface KanbanBoardProps {
  filterStatus?: string
  searchQuery?: string
}

export function KanbanBoard({ filterStatus = "all", searchQuery = "" }: KanbanBoardProps) {
  const { projects, updateProject } = useProjectsStore()
  const [activeProject, setActiveProject] = useState<Project | null>(null)
  const [syncingProjectId, setSyncingProjectId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const filteredProjects = projects.filter(project => {
    const matchesStatus = filterStatus === "all" || project.status === filterStatus
    const query = searchQuery.toLowerCase()
    const matchesSearch = query === "" || 
                          project.name.toLowerCase().includes(query) || 
                          (project.description && project.description.toLowerCase().includes(query)) ||
                          (project.client?.name && project.client.name.toLowerCase().includes(query))

    return matchesStatus && matchesSearch
  })

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const project = projects.find((p) => p.id === active.id)
    if (project) setActiveProject(project)
  }

  function handleDragOver(event: DragOverEvent) {
    // dnd-kit handles drag over visually
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveProject(null)

    if (!over) return

    const activeId = active.id
    const overId = over.id

    const activeProj = projects.find((p) => p.id === activeId)
    if (!activeProj) return

    // If dragging over a column
    const overColumn = COLUMNS.find(col => col.id === overId)
    if (overColumn && activeProj.status !== overColumn.id) {
      try {
        setSyncingProjectId(activeId as string)
        await updateProject(activeId as string, { status: overColumn.id })
      } finally {
        setSyncingProjectId(null)
      }
      return
    }

    // If dragging over another project
    const overProject = projects.find(p => p.id === overId)
    if (overProject && activeProj.status !== overProject.status) {
      try {
        setSyncingProjectId(activeId as string)
        await updateProject(activeId as string, { status: overProject.status })
      } finally {
        setSyncingProjectId(null)
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
      <div className="flex gap-4 sm:gap-6 h-full overflow-x-auto pb-6 snap-x snap-mandatory [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-secondary/20 [&::-webkit-scrollbar-thumb]:bg-primary/20 hover:[&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
        {COLUMNS.filter(col => filterStatus === "all" || col.id === filterStatus).map((col) => (
          <KanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            projects={filteredProjects.filter((p) => p.status === col.id)}
            syncingProjectId={syncingProjectId}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {activeProject ? (
          <div className="w-[334px] rotate-2 scale-105 pointer-events-none opacity-90 shadow-2xl">
            <ProjectCard project={activeProject} isOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
