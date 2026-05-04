import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SortableWidgetProps {
  id: string
  children: React.ReactNode
  size?: 'small' | 'medium' | 'large'
}

export function SortableWidget({ id, children, size = 'small' }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  const sizeClasses = {
    small: 'col-span-1',
    medium: 'col-span-1 lg:col-span-2',
    large: 'col-span-1 lg:col-span-2 xl:col-span-3'
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md',
        sizeClasses[size],
        isDragging && 'opacity-50 ring-2 ring-primary border-primary'
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute right-3 top-3 z-10 cursor-grab rounded-md p-1 opacity-0 transition-opacity hover:bg-muted active:cursor-grabbing group-hover:opacity-100"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="h-full">
        {children}
      </div>
    </div>
  )
}
