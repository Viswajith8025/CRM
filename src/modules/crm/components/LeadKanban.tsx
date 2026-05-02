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
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import type { Contact as Lead, LeadStatus } from '../types'
import { LeadKanbanColumn } from './LeadKanbanColumn'
import { LeadKanbanCard } from './LeadKanbanCard'
import { useCRMStore } from '../crmStore'
import { toast } from 'sonner'

const COLUMNS: { id: LeadStatus; title: string }[] = [
  { id: 'new', title: 'New Leads' },
  { id: 'contacted', title: 'Contacted' },
  { id: 'qualified', title: 'Qualified' },
  { id: 'proposal', title: 'Proposal' },
  { id: 'negotiation', title: 'Negotiation' },
  { id: 'closed_won', title: 'Closed Won' },
  { id: 'closed_lost', title: 'Closed Lost' },
]

interface LeadKanbanProps {
  searchQuery?: string
  segmentFilter?: string
}

export function LeadKanban({ searchQuery = "", segmentFilter = "all" }: LeadKanbanProps) {
  const { leads, updateLead } = useCRMStore()
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [syncingLeadId, setSyncingLeadId] = useState<string | null>(null)

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

  const filteredLeads = leads.filter(lead => {
    const matchesSegment = segmentFilter === "all" || lead.segment === segmentFilter
    const query = searchQuery.toLowerCase()
    const matchesSearch = query === "" || 
                          lead.first_name.toLowerCase().includes(query) || 
                          (lead.last_name && lead.last_name.toLowerCase().includes(query)) ||
                          (lead.company && lead.company.toLowerCase().includes(query))

    return matchesSegment && matchesSearch
  })

  function handleDragStart(event: DragStartEvent) {
    const { active } = event
    const lead = leads.find((l) => l.id === active.id)
    if (lead) setActiveLead(lead)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveLead(null)

    if (!over) return

    const activeId = active.id
    const overId = over.id

    const activeLead = leads.find((l) => l.id === activeId)
    if (!activeLead) return

    // Find the column ID or the task ID we dropped on
    const overColumn = COLUMNS.find(col => col.id === overId)
    const targetStatus = overColumn ? overColumn.id : leads.find(l => l.id === overId)?.status

    if (targetStatus && activeLead.status !== targetStatus) {
      try {
        setSyncingLeadId(activeId as string)
        await updateLead(activeId as string, { status: targetStatus })
        toast.success(`Lead moved to ${targetStatus.replace('_', ' ')}`)
      } catch (err) {
        toast.error("Failed to update lead status")
      } finally {
        setSyncingLeadId(null)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-6 h-full overflow-x-auto pb-8 scrollbar-hide">
        {COLUMNS.map((col) => (
          <LeadKanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            leads={filteredLeads.filter((l) => l.status === col.id)}
            syncingLeadId={syncingLeadId}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? <LeadKanbanCard lead={activeLead} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
