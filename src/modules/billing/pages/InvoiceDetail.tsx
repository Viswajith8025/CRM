import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Printer, Download, ArrowLeft, Mail } from "lucide-react"
import { useBillingStore } from "../billingStore"
import type { Invoice } from "../types"
import { LoadingState } from "@/components/shared/LoadingState"
import { format } from "date-fns"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getInvoiceById, updateInvoiceStatus } = useBillingStore()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    async function load() {
      if (!id) return
      const data = await getInvoiceById(id)
      setInvoice(data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <LoadingState />
  if (!invoice) return <div>Invoice not found</div>

  const handlePrint = () => {
    window.print()
  }

  const handleSendToClient = async () => {
    if (!invoice.id) return;
    setIsSending(true);
    try {
      await updateInvoiceStatus(invoice.id, 'sent');
      setInvoice({ ...invoice, status: 'sent' });
      toast.success("Invoice sent to client successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to send invoice.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <PageWrapper 
      title={`Invoice ${invoice.invoice_number}`} 
      description="Review and manage invoice details."
      className="max-w-4xl mx-auto print:p-0"
      actions={
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => navigate('/billing')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button 
            onClick={handleSendToClient} 
            disabled={isSending || invoice.status === 'sent' || invoice.status === 'paid'}
          >
            <Mail className="h-4 w-4 mr-2" />
            {isSending ? "Sending..." : invoice.status === 'sent' ? "Already Sent" : "Send to Client"}
          </Button>
        </div>
      }
    >
      <div className="bg-card p-8 sm:p-12 border rounded-xl shadow-sm print:border-0 print:shadow-none overflow-hidden relative">
        {/* PDF Ready Layout */}
        <div className="flex flex-col gap-8">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-3xl font-bold text-primary">ERP PRO</h2>
              <p className="text-muted-foreground mt-2">
                123 Business Avenue<br />
                Silicon Valley, CA 94025<br />
                United States
              </p>
            </div>
            <div className="text-right">
              <h1 className="text-4xl font-black text-muted/20 absolute top-4 right-4">INVOICE</h1>
              <div className="space-y-1">
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Invoice Number</p>
                <p className="text-xl font-mono font-bold">{invoice.invoice_number}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">Billed To</p>
              <p className="text-lg font-bold">{invoice.client?.name}</p>
              <p className="text-muted-foreground">
                {invoice.client?.email}<br />
                {invoice.client?.address || "No address provided"}
              </p>
            </div>
            <div className="text-right">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground font-medium">Issue Date:</span>
                <span className="font-bold">{format(new Date(invoice.issued_at), 'MMM d, yyyy')}</span>
                <span className="text-muted-foreground font-medium">Due Date:</span>
                <span className="font-bold">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                <span className="text-muted-foreground font-medium">Project:</span>
                <span className="font-bold">{invoice.project?.name || "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[60%]">Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <p className="font-bold">{invoice.project?.name || "Service Implementation"}</p>
                    <p className="text-sm text-muted-foreground">Development and IT Services for the period ending {format(new Date(invoice.issued_at), 'MMMM yyyy')}</p>
                  </TableCell>
                  <TableCell className="text-right text-lg font-bold">
                    ${invoice.amount.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-end mt-8">
            <div className="w-64 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-bold">${invoice.amount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Tax (0%):</span>
                <span className="font-bold">$0.00</span>
              </div>
              <Separator />
              <div className="flex justify-between text-xl font-black">
                <span>Total:</span>
                <span className="text-primary">${invoice.amount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-20 pt-8 border-t text-center text-xs text-muted-foreground">
            <p>Thank you for your business! Please pay by the due date to avoid service interruption.</p>
            <p className="mt-2">ERP Pro - IT Services & Consulting</p>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
