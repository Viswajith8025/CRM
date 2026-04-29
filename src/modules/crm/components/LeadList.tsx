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
import { Edit2, Trash2, Search, Filter } from "lucide-react"
import { useCRMStore } from "../crmStore"
import { Contact as Lead } from "../types"

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

  const filteredLeads = leads.filter((lead) => 
    lead.first_name.toLowerCase().includes(search.toLowerCase()) ||
    lead.last_name?.toLowerCase().includes(search.toLowerCase()) ||
    lead.company?.toLowerCase().includes(search.toLowerCase()) ||
    lead.email?.toLowerCase().includes(search.toLowerCase())
  )

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
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
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
                    <div className="flex justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => onEdit(lead)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        onClick={() => deleteLead(lead.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
