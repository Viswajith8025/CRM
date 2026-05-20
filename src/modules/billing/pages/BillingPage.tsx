import { useEffect, useState, useMemo } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Plus, Download, TrendingUp, Calendar as CalendarIcon, X, FileSpreadsheet } from "lucide-react"
import { ImportWizard } from "@/components/shared/ImportWizard"
import { InvoiceList } from "../components/InvoiceList"
import { useBillingStore } from "../billingStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InvoiceForm } from "../components/InvoiceForm"
import { format } from "date-fns"

export default function BillingPage() {
  const { fetchInvoices, invoices } = useBillingStore()
  const navigate = useNavigate()
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")

    const [isImportOpen, setIsImportOpen] = useState(false)
  
    const [searchParams] = useSearchParams()
    const initialClient = searchParams.get('client')
  
    useEffect(() => {
      fetchInvoices()
      if (initialClient) {
        setIsFormOpen(true)
      }
    }, [initialClient])
  
    const exportToCSV = () => {
      if (invoices.length === 0) {
        toast.error("No invoices to export")
        return
      }
      const headers = ["Invoice Number", "Client", "Amount", "Status", "Issued Date", "Due Date"]
      const csvContent = [
        headers.join(","),
        ...invoices.map(inv => [
          inv.invoice_number,
          `"${inv.client?.name || 'Unknown'}"`,
          inv.amount,
          inv.status,
          format(new Date(inv.issued_at), 'yyyy-MM-dd'),
          format(new Date(inv.due_date), 'yyyy-MM-dd')
        ].join(","))
      ].join("\n")
  
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", `invoices_export_${format(new Date(), 'yyyy-MM-dd')}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success("Exported successfully")
    }
  
    const totalInvoiced = invoices.reduce((acc, curr) => acc + curr.amount, 0)
    const totalPaid = invoices.filter(i => i.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0)
    const outstanding = totalInvoiced - totalPaid
  
    const clearFilters = () => {
      setStatusFilter("all")
      setStartDate("")
      setEndDate("")
    }
  
    return (
      <PageWrapper 
        title="Billing & Invoices" 
        description="Manage client invoicing, payments, and financial history."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2 font-bold border-primary/20 hover:bg-primary/5" onClick={() => setIsImportOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              Bulk Import
            </Button>
            <Button variant="outline" className="gap-2 font-bold border-primary/20 hover:bg-primary/5 text-primary" onClick={() => navigate('/reports/profitability')}>
              <TrendingUp className="h-4 w-4" />
              Profitability
            </Button>
            <Button variant="outline" className="gap-2 font-bold" onClick={exportToCSV}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button className="gap-2 font-bold" onClick={() => setIsFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New Invoice
            </Button>
          </div>
        }
      >
        <ImportWizard 
          module="invoices" 
          open={isImportOpen} 
          onOpenChange={setIsImportOpen} 
          onComplete={() => fetchInvoices()} 
        />
      <div className="grid gap-6 sm:grid-cols-3 mb-8">
        <Card className="border-border/50 bg-card/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Invoiced</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter">₹{totalInvoiced.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Total Paid</CardTitle>
            <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-emerald-600 dark:text-emerald-400">₹{totalPaid.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-rose-500/5 border-rose-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">Outstanding</CardTitle>
            <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black tracking-tighter text-rose-600 dark:text-rose-400">₹{outstanding.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col gap-4 p-6 rounded-2xl border border-border/50 bg-card/30">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" /> Filter Invoices
            </h3>
            {(statusFilter !== 'all' || startDate || endDate) && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs font-bold text-rose-500 gap-2">
                <X className="h-3 w-3" /> Clear Filters
              </Button>
            )}
          </div>
          
          <div className="grid gap-4 sm:grid-cols-4 items-end">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">From Date</Label>
              <Input 
                type="date" 
                className="bg-background" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">To Date</Label>
              <Input 
                type="date" 
                className="bg-background" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex items-center h-10">
              <p className="text-[10px] font-bold text-muted-foreground italic">
                Filtering {invoices.length} total records
              </p>
            </div>
          </div>
        </div>

        <InvoiceList 
          filterStatus={statusFilter} 
          startDate={startDate}
          endDate={endDate}
        />
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Invoice</DialogTitle>
            <DialogDescription>
              Fill out the details to generate a new invoice for a client.
            </DialogDescription>
          </DialogHeader>
          <InvoiceForm 
            onSuccess={() => setIsFormOpen(false)} 
            defaultClientId={initialClient || undefined}
          />
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
