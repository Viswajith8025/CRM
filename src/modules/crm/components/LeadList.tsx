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
import { Edit2, Trash2, Search, Filter, MoreHorizontal, Eye } from "lucide-react"
import { useCRMStore } from "../crmStore"
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
  const { leads, isLoading, deleteLead, fetchLeads, pagination } = useCRMStore()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    // Initial fetch with current search
    fetchLeads({ page: 1, limit: 10, filters: search ? { name: search } : {} })
  }, [])

  useEffect(() => {
    const urlSearch = searchParams.get("search")
    if (urlSearch && urlSearch !== search) {
      setSearch(urlSearch)
      fetchLeads({ page: 1, limit: 10, filters: { name: urlSearch } })
    }
  }, [searchParams])

  const handleSearch = (val: string) => {
    setSearch(val)
    // Debounced or direct search
    fetchLeads({ page: 1, limit: 10, filters: { name: val } })
  }

  const handleDeleteLead = async () => {
    if (!deleteId) return
    try {
      await deleteLead(deleteId)
      toast.success("Lead deleted")
      fetchLeads({ page: pagination.leads.page, limit: pagination.leads.limit })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete lead")
    } finally {
      setDeleteId(null)
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
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => fetchLeads({ 
            page: 1, 
            sortOrder: pagination.leads.page === 1 ? 'asc' : 'desc' 
          } as any)}
        >
          <Filter className="h-4 w-4" />
          Quick Sort
        </Button>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Value</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  <div className="flex flex-col items-center gap-2">
                    <MoreHorizontal className="h-4 w-4 animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Fetching Lead Matrix...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  <p className="text-sm font-bold text-muted-foreground italic">No leads found for this criteria.</p>
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer hover:bg-primary/5 transition-colors group" onClick={() => onViewDetails(lead)}>
                  <TableCell className="font-medium">
                    <span className="font-black text-sm">{lead.first_name} {lead.last_name}</span>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{lead.email}</p>
                  </TableCell>
                  <TableCell className="font-bold text-xs uppercase opacity-70">{lead.company || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("uppercase font-black text-[9px] px-2 py-0.5", statusColors[lead.status])}>
                      {lead.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-black text-sm text-foreground">${Number(lead.value || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
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
            disabled={pagination.leads.page === 1}
            onClick={() => fetchLeads({ page: pagination.leads.page - 1 })}
            className="h-8 px-4 font-black uppercase text-[10px]"
          >
            Prev
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={pagination.leads.page === pagination.leads.totalPages}
            onClick={() => fetchLeads({ page: pagination.leads.page + 1 })}
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
