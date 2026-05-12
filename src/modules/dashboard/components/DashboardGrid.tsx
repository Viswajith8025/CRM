import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { useDashboardStore, type WidgetId, WIDGET_REGISTRY } from '../dashboardStore'
import { SortableWidget } from './SortableWidget'
import { usePermissions } from '@/hooks/usePermissions.tsx'

// Lazy load actual widgets to keep initial bundle small
import { RevenueWidget } from './widgets/RevenueWidget'
import { TasksWidget } from './widgets/TasksWidget'
import { ProjectsWidget } from './widgets/ProjectsWidget'
import { ActivityWidget } from './widgets/ActivityWidget'
import { CriticalDeadlinesWidget } from './widgets/CriticalDeadlinesWidget'
import { CashFlowWidget } from './widgets/CashFlowWidget'

const WIDGET_COMPONENTS: Record<WidgetId, any> = {
  revenue_summary: RevenueWidget,
  recent_tasks: TasksWidget,
  active_projects: ProjectsWidget,
  recent_activity: ActivityWidget,
  critical_deadlines: CriticalDeadlinesWidget,
  cash_flow: CashFlowWidget,
  lead_funnel: () => <div>Lead Funnel Placeholder</div>,
  team_productivity: () => <div>Team Productivity Placeholder</div>
}

export function DashboardGrid() {
  const { layout, setLayout } = useDashboardStore()
  const { can } = usePermissions()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Allow small movement before dragging starts (allows clicking buttons inside widgets)
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Filter widgets based on user permissions
  const visibleWidgets = layout.filter(id => {
    const config = WIDGET_REGISTRY[id]
    if (!config) return false
    if (!config.requiredPermission) return true
    return can(config.requiredPermission)
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = visibleWidgets.indexOf(active.id as WidgetId)
      const newIndex = visibleWidgets.indexOf(over.id as WidgetId)
      
      const newLayout = arrayMove(visibleWidgets, oldIndex, newIndex)
      setLayout(newLayout)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={visibleWidgets}
        strategy={rectSortingStrategy}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-1">
          {visibleWidgets.map((id) => {
            const Widget = WIDGET_COMPONENTS[id]
            const config = WIDGET_REGISTRY[id]
            
            return (
              <SortableWidget key={id} id={id} size={config.defaultSize}>
                <Widget />
              </SortableWidget>
            )
          })}
        </div>
      </SortableContext>
    </DndContext>
  )
}
