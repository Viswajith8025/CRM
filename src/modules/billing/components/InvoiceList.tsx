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
import { FileText, MoreHorizontal, CheckCircle2 } from "lucide-react"
import { useBillingStore } from "../billingStore"
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"

const statusColors: Record<string, string> = {
  draft: "bg-slate-500/10 text-slate-500",
  sent: "bg-blue-500/10 text-blue-500",
  paid: "bg-emerald-500/10 text-emerald-500",
  overdue: "bg-rose-500/10 text-rose-500",
  cancelled: "bg-rose-500/10 text-rose-500",
}

export function InvoiceList() {
  const { invoices, isLoading, updateInvoiceStatus } = useBillingStore()
  const navigate = useNavigate()

  return (
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
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                Loading invoices...
              </TableCell>
            </TableRow>
          ) : invoices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                No invoices found.
              </TableCell>
            </TableRow>
          ) : (
            invoices.map((invoice) => (
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
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => navigate(`/billing/${invoice.id}`)}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                    {invoice.status !== 'paid' && (
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="text-emerald-500 hover:text-emerald-600"
                        onClick={() => updateInvoiceStatus(invoice.id, 'paid')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
