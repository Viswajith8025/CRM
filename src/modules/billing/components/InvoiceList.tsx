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
import { useState, useEffect } from "react"
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
import { AdvancedInvoiceFilter } from "./AdvancedInvoiceFilter"

interface FilterCriteria {
  minAmount?: number
  maxAmount?: number
  status?: string
  clientName?: string
  dateFrom?: string
  dateTo?: string
}

const statusColors: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-500",
  sent: "bg-blue-500/10 text-blue-500",
  partially_paid: "bg-amber-500/10 text-amber-500",
  paid: "bg-emerald-500/10 text-emerald-500",
  overdue: "bg-rose-500/10 text-rose-500",
  cancelled: "bg-rose-500/10 text-rose-500",
}

interface InvoiceListProps {
  filterStatus?: string
  startDate?: string
  endDate?: string
}

import { useSearchParams } from "react-router-dom"

export function InvoiceList({ filterStatus = "all", startDate, endDate }: InvoiceListProps) {
  const { invoices, isLoading, updateInvoiceStatus, deleteInvoice, fetchInvoices, pagination } = useBillingStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(searchParams.get("search") || "")
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [advancedCriteria, setAdvancedCriteria] = useState<FilterCriteria>({})

  useEffect(() => {
    // Enterprise Fetch: Centralized filtering at database level
    fetchInvoices({
      page: 1,
      limit: 10,
      filters: {
        status: filterStatus !== "all" ? filterStatus : undefined,
        search: search || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        ...advancedCriteria
      }
    })
  }, [filterStatus, search, startDate, endDate, advancedCriteria])

  useEffect(() => {
    const urlSearch = searchParams.get("search")
    if (urlSearch && urlSearch !== search) {
      setSearch(urlSearch)
    }
  }, [searchParams])

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await deleteInvoice(deleteId)
      toast.success("Invoice deleted")
      fetchInvoices({ page: pagination.invoices.page })
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
            className="pl-9 h-11 bg-card/30" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <AdvancedInvoiceFilter onFilterChange={setAdvancedCriteria} />
        <Button 
          variant="outline" 
          className="gap-2 h-11"
          onClick={() => fetchInvoices({ 
            page: 1, 
            sortOrder: pagination.invoices.page === 1 ? 'asc' : 'desc' 
          } as any)}
        >
          <Filter className="h-4 w-4" />
          Quick Sort
        </Button>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border/50 bg-card/30 p-12 text-center">
          <div className="flex flex-col items-center gap-2">
            <MoreHorizontal className="h-6 w-6 animate-pulse text-primary" />
            <p className="text-[10px] font-black uppercase tracking-widest opacity-40 text-muted-foreground">Aggregating Financial Ledger...</p>
          </div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl bg-card/10 border-border/50">
          <div className="h-16 w-16 rounded-2xl bg-accent/50 flex items-center justify-center mb-4">
            <FileText className="h-8 w-8 text-muted-foreground opacity-50" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-tight">No invoices detected</h3>
          <p className="text-xs text-muted-foreground max-w-[240px] mx-auto mt-1">
            Try adjusting your search or filters to locate specific billing records.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 border-b border-border/50">
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Invoice #</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Entity</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gross Amount</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Schedule</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Actions</th>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className="group hover:bg-primary/5 transition-colors cursor-pointer" onClick={() => navigate(`/billing/${invoice.id}`)}>
                  <TableCell className="font-mono font-black text-xs text-primary">
                    {invoice.invoice_number}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{invoice.client?.name}</span>
                      <span className="text-[10px] font-bold uppercase text-muted-foreground opacity-60 tracking-tight">{invoice.project?.name || "Operational Billing"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-sm">
                    ₹{Number(invoice.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                      <span className="text-[9px] font-medium opacity-40">Issued: {format(new Date(invoice.issued_at), 'MMM d, yyyy')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn("uppercase font-black text-[9px] px-2 py-0.5", statusColors[invoice.status])}>
                      {invoice.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => navigate(`/billing/${invoice.id}`)} className="gap-2 font-bold text-xs uppercase">
                          <Eye className="h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        {invoice.status !== 'paid' && (
                          <DropdownMenuItem 
                            onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                            className="gap-2 text-emerald-600 font-black text-xs uppercase"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Finalize Payment
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem 
                          className="text-rose-500 focus:text-rose-600 focus:bg-rose-50 gap-2 font-black text-xs uppercase" 
                          onClick={() => setDeleteId(invoice.id)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete Records
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

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-2 pt-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
          Showing <span className="text-foreground">{(pagination.invoices.page - 1) * pagination.invoices.limit + 1}-{Math.min(pagination.invoices.page * pagination.invoices.limit, pagination.invoices.totalCount)}</span> of <span className="text-foreground">{pagination.invoices.totalCount}</span> invoices
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={pagination.invoices.page === 1}
            onClick={() => fetchInvoices({ page: pagination.invoices.page - 1 })}
            className="h-8 px-4 font-black uppercase text-[10px]"
          >
            Prev
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={pagination.invoices.page === pagination.invoices.totalPages}
            onClick={() => fetchInvoices({ page: pagination.invoices.page + 1 })}
            className="h-8 px-4 font-black uppercase text-[10px]"
          >
            Next
          </Button>
        </div>
      </div>

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
