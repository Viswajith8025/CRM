import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Edit2, Trash2, Search, MoreHorizontal, FileText, Eye, Info } from "lucide-react"
import { useCRMStore } from "../crmStore"

import type { Client } from "../types"
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
import { useNavigate } from "react-router-dom"
import { ActivityTimeline } from "@/components/shared/ActivityTimeline"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useSearchParams } from "react-router-dom"
import { ClientDetailSheet } from "./ClientDetailSheet"

interface ClientListProps {
  onEdit: (client: Client) => void
  onCreateProposal: (client: Client) => void
  onViewProposals: (client: Client) => void
}

export function ClientList({ onEdit, onCreateProposal, onViewProposals }: ClientListProps) {
  const { clients, isLoading, deleteClient, fetchClients } = useCRMStore()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [timelineClient, setTimelineClient] = useState<Client | null>(null)
  const [detailClient, setDetailClient] = useState<Client | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    fetchClients()
    const urlSearch = searchParams.get("search")
    if (urlSearch && urlSearch !== search) {
      setSearch(urlSearch)
    }
  }, [fetchClients, searchParams])

  const handleDeleteClient = async () => {
    if (!deleteId) return
    try {
      await deleteClient(deleteId)
      toast.success("Client removed")
    } catch (error) {
      toast.error("Failed to delete client")
    } finally {
      setDeleteId(null)
    }
  }

  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.email?.toLowerCase().includes(search.toLowerCase()) ||
    client.service?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search active clients..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-md border bg-card/30 backdrop-blur-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-bold">Client Name</TableHead>
              <TableHead className="font-bold">Service</TableHead>
              <TableHead className="font-bold">Contract Value</TableHead>
              <TableHead className="text-right font-bold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24">
                  Loading clients...
                </TableCell>
              </TableRow>
            ) : filteredClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                  No active clients found.
                </TableCell>
              </TableRow>
            ) : (
              filteredClients.map((client) => (
                <TableRow key={client.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="font-bold">{client.name}</div>
                    <div className="text-xs text-muted-foreground">{client.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium px-2 py-1 rounded-md bg-primary/10 text-primary">
                        {client.service || "Not specified"}
                      </span>
                      {client.isVirtual && (
                        <span className="text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          Converted
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-mono font-bold text-emerald-500">
                    ${client.contract_value?.toLocaleString() || "0.00"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 border-sky-200 hover:bg-sky-50 text-sky-600 font-bold"
                        onClick={() => setDetailClient(client)}
                      >
                        <Info className="h-3.5 w-3.5" />
                        Details
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-2 border-primary/20 hover:bg-primary/10 text-primary"
                        onClick={() => navigate(`/billing?client=${client.id}`)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Invoice
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(client)} className="gap-2">
                            <Edit2 className="h-4 w-4" /> Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => onCreateProposal(client)}
                          >
                            <FileText className="h-4 w-4" />
                            Create Proposal
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => setTimelineClient(client)}
                          >
                            <Eye className="h-4 w-4" />
                            View History
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer"
                            onClick={() => onViewProposals(client)}
                          >
                            <Eye className="h-4 w-4" />
                            View Proposals
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 gap-2 font-bold"
                            onClick={() => setDeleteId(client.id)}
                          >
                            <Trash2 className="h-4 w-4" /> Remove Client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
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
            <AlertDialogTitle>Remove Active Client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the client from your active list. Historical data like invoices will remain in the billing module.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteClient}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity Timeline Sheet */}
      <Sheet open={!!timelineClient} onOpenChange={(open) => !open && setTimelineClient(null)}>
        <SheetContent className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2 text-lg font-black">
              {timelineClient?.name}
            </SheetTitle>
            <SheetDescription>
              Full activity history for this client relationship.
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="flex-1 p-6">
            {timelineClient && (
              <ActivityTimeline
                entityId={timelineClient.id}
                relatedEntityId={timelineClient.lead_id ?? undefined}
                showEntityBadge={true}
                limit={50}
              />
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Client Detail Sheet */}
      <ClientDetailSheet
        client={detailClient}
        open={!!detailClient}
        onOpenChange={(open) => !open && setDetailClient(null)}
      />
    </div>
  )
}
