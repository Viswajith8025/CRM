import { useState, useEffect, useCallback, useRef } from 'react'
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
import { useCRMStore } from "../crmStore"
import { toast } from 'sonner'

const COLUMNS: { id: LeadStatus; title: string }[] = [
  { id: 'new', title: 'New Leads' },
  { id: 'contacted', title: 'Contacted' },
  { id: 'qualified', title: 'Qualified' },
  { id: 'proposal_sent', title: 'Proposal Sent' },
  { id: 'negotiation', title: 'Negotiation' },
  { id: 'awaiting_payment', title: 'Awaiting Payment' },
  { id: 'active_client', title: 'Converted Clients' },
  { id: 'closed_lost', title: 'Closed Lost' },
]

interface LeadKanbanProps {
  searchQuery?: string
  segmentFilter?: string
  onEdit?: (lead: Lead) => void
  onViewDetails?: (lead: Lead) => void
}

export function LeadKanban({ searchQuery = "", segmentFilter = "all", onEdit, onViewDetails }: LeadKanbanProps) {
  const { leads: storeLeads, updateLead } = useCRMStore()
  const [activeLead, setActiveLead] = useState<Lead | null>(null)
  const [syncingLeadId, setSyncingLeadId] = useState<string | null>(null)

  // LOCAL copy of leads that we fully control — this prevents any store
  // re-fetch from snapping the card back to its old column.
  const [localLeads, setLocalLeads] = useState<Lead[]>(storeLeads)
  
  // Track which leads have been manually moved by drag-and-drop
  // so we don't overwrite them when the store refreshes
  const movedLeadIds = useRef<Set<string>>(new Set())

  // Sync store leads → local leads, BUT preserve any manually-moved cards
  useEffect(() => {
    setLocalLeads(prev => {
      if (movedLeadIds.current.size === 0) {
        // No pending moves, just sync everything from the store
        return storeLeads
      }
      // Merge: use store data for non-moved leads, keep local status for moved ones
      const movedMap = new Map(prev.filter(l => movedLeadIds.current.has(l.id)).map(l => [l.id, l]))
      return storeLeads.map(l => movedMap.has(l.id) ? { ...l, status: movedMap.get(l.id)!.status } : l)
    })
  }, [storeLeads])

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

  const filteredLeads = localLeads.filter(lead => {
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
    const lead = localLeads.find((l) => l.id === active.id)
    if (lead) setActiveLead(lead)
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveLead(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id

    const draggedLead = localLeads.find((l) => l.id === activeId)
    if (!draggedLead) return

    // Find the column ID or the card's column we dropped on
    const overColumn = COLUMNS.find(col => col.id === overId)
    const targetStatus = overColumn ? overColumn.id : localLeads.find(l => l.id === overId)?.status

    if (targetStatus && draggedLead.status !== targetStatus) {
      // 1. IMMEDIATELY move the card in local state — this is instant and
      //    cannot be overwritten by any background store fetch
      movedLeadIds.current.add(activeId)
      setLocalLeads(prev =>
        prev.map(l => l.id === activeId ? { ...l, status: targetStatus } : l)
      )

      // 2. Persist the change to the database in the background
      try {
        setSyncingLeadId(activeId)
        await updateLead(activeId, { status: targetStatus })
        toast.success(`Lead moved to ${targetStatus.replace('_', ' ')}`)
      } catch (err) {
        // Revert the local move on failure
        setLocalLeads(prev =>
          prev.map(l => l.id === activeId ? { ...l, status: draggedLead.status } : l)
        )
        toast.error("Failed to update lead status")
      } finally {
        // After the DB operation completes (success or fail), stop protecting this lead
        movedLeadIds.current.delete(activeId)
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
      <div className="flex gap-4 sm:gap-6 h-full overflow-x-auto pb-6 snap-x snap-mandatory [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-secondary/20 [&::-webkit-scrollbar-thumb]:bg-primary/20 hover:[&::-webkit-scrollbar-thumb]:bg-primary/40 [&::-webkit-scrollbar-thumb]:rounded-full transition-colors">
        {COLUMNS.map((col) => (
          <LeadKanbanColumn
            key={col.id}
            id={col.id}
            title={col.title}
            leads={filteredLeads.filter((l) => l.status === col.id)}
            syncingLeadId={syncingLeadId}
            onEdit={onEdit}
            onViewDetails={onViewDetails}
          />
        ))}
      </div>

      <DragOverlay>
        {activeLead ? <LeadKanbanCard lead={activeLead} isOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
