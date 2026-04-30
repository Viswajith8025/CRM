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
import { FileText, MoreHorizontal, CheckCircle2, Trash2, Filter, Search, Eye } from "lucide-react"
import { useBillingStore } from "../billingStore"
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns"
import { useNavigate } from "react-router-dom"
import { useState } from "react"
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
  draft: "bg-slate-500/10 text-slate-500",
  sent: "bg-blue-500/10 text-blue-500",
  paid: "bg-emerald-500/10 text-emerald-500",
  overdue: "bg-rose-500/10 text-rose-500",
  cancelled: "bg-rose-500/10 text-rose-500",
}

interface InvoiceListProps {
  filterStatus?: string
  startDate?: string
  endDate?: string
}

export function InvoiceList({ filterStatus = "all", startDate, endDate }: InvoiceListProps) {
  const { invoices, isLoading, updateInvoiceStatus, deleteInvoice } = useBillingStore()
  const navigate = useNavigate()
  const [search, setSearch] = useState("")
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filteredInvoices = invoices
    .filter((inv) => {
      const matchesSearch = inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
                           inv.client?.name?.toLowerCase().includes(search.toLowerCase())
      const matchesStatus = filterStatus === "all" || inv.status === filterStatus
      
      let matchesDate = true
      if (startDate) {
        matchesDate = matchesDate && !isBefore(new Date(inv.issued_at), startOfDay(new Date(startDate)))
      }
      if (endDate) {
        matchesDate = matchesDate && !isAfter(new Date(inv.issued_at), endOfDay(new Date(endDate)))
      }

      return matchesSearch && matchesStatus && matchesDate
    })
    .sort((a, b) => {
      const valA = new Date(a.due_date).getTime()
      const valB = new Date(b.due_date).getTime()
      return sortOrder === "asc" ? valA - valB : valB - valA
    })

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteInvoice(deleteId)
      toast.success("Invoice deleted")
    } catch (error) {
      toast.error("Failed to delete invoice")
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
            placeholder="Search by invoice number or client..." 
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
          Sort Due Date: {sortOrder === "asc" ? "Oldest First" : "Newest First"}
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">
          Loading invoices...
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-xl bg-card/50">
          <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center mb-4">
            <FileText className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">No invoices found</h3>
          <p className="text-muted-foreground max-w-xs mx-auto">
            {search || filterStatus !== "all" || startDate || endDate
              ? "Try adjusting your filters to find what you're looking for." 
              : "You haven't created any invoices yet. Start billing your clients to see them here."}
          </p>
        </div>
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id} className="group">
                  <TableCell className="font-mono font-bold text-primary">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{invoice.client?.name}</span>
                      <span className="text-xs text-muted-foreground">{invoice.project?.name || "General Billing"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold">
                    ${invoice.amount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(invoice.issued_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[invoice.status]}>
                      {invoice.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => navigate(`/billing/${invoice.id}`)} className="gap-2">
                          <Eye className="h-4 w-4" /> View Invoice
                        </DropdownMenuItem>
                        {invoice.status !== 'paid' && (
                          <DropdownMenuItem 
                            onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                            className="gap-2 text-emerald-600 font-medium"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Mark as Paid
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 gap-2 font-bold" 
                          onClick={() => setDeleteId(invoice.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this invoice? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-500 hover:bg-rose-600 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
