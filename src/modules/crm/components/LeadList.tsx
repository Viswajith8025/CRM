import { useState } from "react"
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
import type { Contact as Lead } from "../types"
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
import { toast } from "sonner"

const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-500",
  contacted: "bg-amber-500/10 text-amber-500",
  qualified: "bg-purple-500/10 text-purple-500",
  proposal: "bg-indigo-500/10 text-indigo-500",
  negotiation: "bg-orange-500/10 text-orange-500",
  closed_won: "bg-emerald-500/10 text-emerald-500",
  closed_lost: "bg-rose-500/10 text-rose-500",
}

interface LeadListProps {
  onEdit: (lead: Lead) => void
}

export function LeadList({ onEdit }: LeadListProps) {
  const { leads, isLoading, deleteLead } = useCRMStore()
  const [search, setSearch] = useState("")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDeleteLead = async () => {
    if (!deleteId) return
    try {
      await deleteLead(deleteId)
      toast.success("Lead deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete lead")
    } finally {
      setDeleteId(null)
    }
  }

  const filteredLeads = leads
    .filter((lead) =>
      lead.first_name.toLowerCase().includes(search.toLowerCase()) ||
      lead.last_name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.company?.toLowerCase().includes(search.toLowerCase()) ||
      lead.email?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const valA = a.value || 0
      const valB = b.value || 0
      return sortOrder === "asc" ? valA - valB : valB - valA
    })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
        >
          <Filter className="h-4 w-4" />
          Sort Value: {sortOrder === "asc" ? "Low to High" : "High to Low"}
        </Button>
      </div>

      <div className="rounded-md border">
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
                  Loading leads...
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-24">
                  No leads found.
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    {lead.first_name} {lead.last_name}
                    <p className="text-xs text-muted-foreground">{lead.email}</p>
                  </TableCell>
                  <TableCell>{lead.company || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[lead.status]}>
                      {lead.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>${lead.value?.toLocaleString() || "0"}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(lead)} className="gap-2">
                          <Edit2 className="h-4 w-4" /> Edit Lead
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 gap-2 font-bold" 
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
