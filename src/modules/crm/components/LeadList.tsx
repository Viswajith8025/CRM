import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit2, Trash2, Search, Filter, MoreHorizontal, Eye, Calendar, CalendarPlus, Mail, PhoneCall, MessageCircle } from "lucide-react"
import { useCRMStore } from "../crmStore"
import { useTeamStore } from "@/modules/admin/teamStore"
import { format } from "date-fns"
import type { Contact as Lead, LeadStatus } from "../types"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const statusColors: Record<LeadStatus, string> = {
  new: "bg-blue-500/10 text-blue-500",
  contacted: "bg-amber-500/10 text-amber-500",
  qualified: "bg-purple-500/10 text-purple-500",
  proposal_sent: "bg-indigo-500/10 text-indigo-500",
  negotiation: "bg-orange-500/10 text-orange-500",
  awaiting_payment: "bg-yellow-500/10 text-yellow-600",
  active_client: "bg-emerald-500/10 text-emerald-500",
  closed_lost: "bg-rose-500/10 text-rose-500",
}

interface LeadListProps {
  onEdit: (lead: Lead) => void
  onViewDetails: (lead: Lead) => void
}

import { useSearchParams } from "react-router-dom"

export function LeadList({ onEdit, onViewDetails }: LeadListProps) {
  const { leads, isLoading, deleteLead, fetchLeads, pagination, updateLead } = useCRMStore()
  const { members, fetchMembers } = useTeamStore()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [bdeFilter, setBdeFilter] = useState<string>("all")
  const [dateStart, setDateStart] = useState<string>("")
  const [dateEnd, setDateEnd] = useState<string>("")

  // BDE Filter Logic (matches LeadForm)
  const strictBdeUsers = (members || []).filter(m => {
    const role = (m.role || '').toLowerCase().trim()
    const dynRole = (m.dynamic_role_name || '').toLowerCase().trim()
    const dept = (m.department || '').toLowerCase().trim()
    
    const isSalesRole = role === 'sales' || role.includes('bde') || dynRole.includes('sales') || dynRole.includes('bde')
    const isBdeDept = dept.includes('bde') || dept.includes('sales')
    return isSalesRole && isBdeDept && !!m.id
  })
  const bdeRoleUsers = (members || []).filter(m => {
    const role = (m.role || '').toLowerCase().trim()
    const dynRole = (m.dynamic_role_name || '').toLowerCase().trim()
    return (role === 'sales' || role.includes('bde') || dynRole.includes('sales') || dynRole.includes('bde')) && !!m.id
  })
  const bdeUsers = strictBdeUsers.length > 0 
    ? strictBdeUsers 
    : (bdeRoleUsers.length > 0 ? bdeRoleUsers : (members || []))

  const PAGE_SIZE = 10

  useEffect(() => {
    fetchLeads({ page: 1, limit: PAGE_SIZE, filters: search ? { name: search } : {} })
    fetchMembers()
  }, [])

  useEffect(() => {
    const urlSearch = searchParams.get("search")
    if (urlSearch && urlSearch !== search) {
      setSearch(urlSearch)
      fetchLeads({ page: 1, limit: PAGE_SIZE, filters: { name: urlSearch } })
    }
  }, [searchParams])

  const applyFilters = (overrides?: any) => {
    const filters: any = {}
    if (search) filters.name = search
    if (bdeFilter && bdeFilter !== "all") filters.brought_by_id = bdeFilter
    if (dateStart) filters.date_start = new Date(dateStart).toISOString()
    if (dateEnd) filters.date_end = new Date(new Date(dateEnd).setHours(23, 59, 59)).toISOString()
    
    fetchLeads({ 
      page: 1, 
      limit: PAGE_SIZE, 
      sortOrder: sortOrder,
      filters,
      ...overrides
    })
  }

  const handleSearch = (val: string) => {
    setSearch(val)
    applyFilters({ filters: { ...((search ? { name: val } : {})), brought_by_id: bdeFilter !== 'all' ? bdeFilter : undefined, date_start: dateStart ? new Date(dateStart).toISOString() : undefined, date_end: dateEnd ? new Date(new Date(dateEnd).setHours(23, 59, 59)).toISOString() : undefined } })
  }

  useEffect(() => {
    applyFilters()
  }, [sortOrder, bdeFilter, dateStart, dateEnd])

  const handleDeleteLead = async () => {
    if (!deleteId) return
    try {
      await deleteLead(deleteId)
      toast.success("Lead deleted")
      fetchLeads({ page: pagination.leads.page, limit: PAGE_SIZE })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete lead")
    } finally {
      setDeleteId(null)
    }
  }

  const handleFollowUp = async (leadId: string) => {
    try {
      await updateLead(leadId, { last_contacted_at: new Date().toISOString() })
      toast.success("Follow-up logged successfully")
    } catch (error) {
      toast.error("Failed to log follow-up")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads by name, email or company..."
            className="pl-9"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 relative">
              <Filter className="h-4 w-4" />
              Filter
              {(bdeFilter !== 'all' || dateStart || dateEnd) && (
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="end">
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-bold uppercase tracking-tight text-[11px] text-muted-foreground">Filter Leads</h4>
                <p className="text-xs text-muted-foreground">Refine the list of leads by BDE or Date.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight">Assigned BDE</Label>
                <Select value={bdeFilter} onValueChange={setBdeFilter}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="All BDEs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All BDEs</SelectItem>
                    {bdeUsers.map(bde => (
                        <SelectItem key={bde.id} value={bde.id}>{bde.full_name || bde.email}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-tight">Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Start</Label>
                    <Input type="date" className="h-8 text-xs" value={dateStart} onChange={e => setDateStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">End</Label>
                    <Input type="date" className="h-8 text-xs" value={dateEnd} onChange={e => setDateEnd(e.target.value)} />
                  </div>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-xs" 
                onClick={() => {
                  setBdeFilter("all")
                  setDateStart("")
                  setDateEnd("")
                }}
              >
                Clear Filters
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="h-4 w-4" />
              {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setSortOrder('desc')} className={sortOrder === 'desc' ? 'font-bold bg-muted' : ''}>
              Newest First (Default)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortOrder('asc')} className={sortOrder === 'asc' ? 'font-bold bg-muted' : ''}>
              Oldest First
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>BDE</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Remarks</TableHead>
              <TableHead>Connect</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  <div className="flex flex-col items-center gap-2">
                    <MoreHorizontal className="h-4 w-4 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Fetching Lead Matrix...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center h-24">
                  <p className="text-sm font-bold text-muted-foreground italic">No leads found for this criteria.</p>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-primary/5 transition-colors group" onClick={() => onViewDetails(lead)}>
                  <TableCell className="font-medium">
                    <span className="font-black text-sm">{lead.first_name} {lead.last_name}</span>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{lead.company || "No Company"}</p>
                  </TableCell>
                  <TableCell className="font-bold text-xs">
                    {lead.phone || <span className="text-muted-foreground italic opacity-70">N/A</span>}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select 
                      value={lead.status} 
                      onValueChange={async (val) => {
                        const updates: any = { status: val as LeadStatus }
                        if (val === 'contacted') {
                          updates.last_contacted_at = new Date().toISOString()
                          // Automatically log the interaction
                          try {
                            await useCRMStore.getState().addInteraction({
                              lead_id: lead.id,
                              type: 'call',
                              content: `System auto-log: Lead status changed to Contacted at ${new Date().toLocaleTimeString()}`
                            })
                          } catch (e) {
                            console.error("Failed to auto-log interaction", e)
                          }
                        }
                        updateLead(lead.id, updates)
                          .then(() => toast.success("Status updated to " + val.replace('_', ' ')))
                          .catch(() => toast.error("Failed to update status"))
                      }}
                    >
                      <SelectTrigger className={cn("h-7 px-2 text-[10px] font-black uppercase border-0 shadow-none w-[130px]", statusColors[lead.status])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(statusColors).map(([status, colorClass]) => (
                          <SelectItem key={status} value={status} className={cn("text-[10px] uppercase font-bold", colorClass)}>
                            {status.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="font-medium text-[11px] max-w-[120px] truncate" title={lead.requirement || ''}>
                    {lead.requirement ? (
                      <span className="text-muted-foreground">{lead.requirement}</span>
                    ) : (
                      <span className="text-muted-foreground italic opacity-70">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="font-bold text-[10px] uppercase">
                    {(() => {
                      const bde = (members || []).find(m => m.id === lead.brought_by_id)
                      return bde ? (bde.full_name || bde.email || 'Unknown') : <span className="text-muted-foreground italic opacity-70">Unassigned</span>
                    })()}
                  </TableCell>
                  <TableCell className="font-black text-sm text-foreground">${Number(lead.value || 0).toLocaleString()}</TableCell>
                  <TableCell className="font-medium text-[11px] max-w-[150px] truncate" title={lead.remarks || ''}>
                    {lead.remarks ? (
                      <span className="text-muted-foreground">{lead.remarks}</span>
                    ) : (
                      <span className="text-muted-foreground italic opacity-70">No remarks</span>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      {lead.phone && (
                        <>
                          <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="p-1.5 bg-blue-50 text-blue-500 rounded hover:bg-blue-100 transition-colors" title="Call">
                            <PhoneCall className="h-3.5 w-3.5" />
                          </a>
                          <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 bg-emerald-50 text-emerald-500 rounded hover:bg-emerald-100 transition-colors" title="WhatsApp">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        </>
                      )}
                      {lead.email && (
                        <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} className="p-1.5 bg-purple-50 text-purple-500 rounded hover:bg-purple-100 transition-colors" title="Email">
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!lead.phone && !lead.email && (
                        <span className="text-[10px] italic text-muted-foreground opacity-50">N/A</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleFollowUp(lead.id)} className="gap-2 font-bold text-xs uppercase text-emerald-600 focus:text-emerald-700">
                          <PhoneCall className="h-4 w-4" /> Log Follow-up
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onViewDetails(lead)} className="gap-2 font-bold text-xs uppercase">
                          <Eye className="h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(lead)} className="gap-2 font-bold text-xs uppercase">
                          <Edit2 className="h-4 w-4" /> Edit Lead
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 gap-2 font-black text-xs uppercase" 
                          onClick={() => setDeleteId(lead.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-2 pt-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
          Showing <span className="text-foreground">{(pagination.leads.page - 1) * pagination.leads.limit + 1}-{Math.min(pagination.leads.page * pagination.leads.limit, pagination.leads.totalCount)}</span> of <span className="text-foreground">{pagination.leads.totalCount}</span> leads
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={pagination.leads.page <= 1}
            onClick={() => fetchLeads({ page: pagination.leads.page - 1, limit: PAGE_SIZE })}
            className="h-8 px-4 font-black uppercase text-[10px]"
          >
            Prev
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={pagination.leads.totalPages <= 1 || pagination.leads.page >= pagination.leads.totalPages}
            onClick={() => fetchLeads({ page: pagination.leads.page + 1, limit: PAGE_SIZE })}
            className="h-8 px-4 font-black uppercase text-[10px]"
          >
            Next
          </Button>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the lead record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLead}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              Delete Lead
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
