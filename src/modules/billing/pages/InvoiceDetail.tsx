import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Printer, Download, ArrowLeft, Mail, Paperclip } from "lucide-react"
import { useBillingStore } from "../billingStore"
import type { Invoice } from "../types"
import { LoadingState } from "@/components/shared/LoadingState"
import { format } from "date-fns"
import { Separator } from "@/components/ui/separator"
import { FileUploadZone } from "@/modules/documents/components/FileUploadZone"
import { AttachmentList } from "@/modules/documents/components/AttachmentList"
import { SignatureDialog } from "@/components/shared/SignatureDialog"
import { CheckCircle2, ShieldCheck, PenTool } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"

import { ProfessionalInvoice } from "../components/ProfessionalInvoice"
import { PaymentVerificationList } from "../components/PaymentVerificationList"
import { VersionHistoryTimeline } from "@/components/shared/VersionHistoryTimeline"

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getInvoiceById, updateInvoiceStatus } = useBillingStore()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isSignatureOpen, setIsSignatureOpen] = useState(false)

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
      let emailDispatched = false;
      
      // Attempt to send the actual email via Resend if client has an email
      if (invoice.client?.email) {
        try {
          const { sendEmail } = await import('@/lib/email');
          const { exportInvoiceToPDF } = await import('@/lib/exportUtils');
          
          // Generate PDF base64
          const pdfBase64 = exportInvoiceToPDF(invoice, true) as string;

          await sendEmail({
            to: invoice.client.email,
            subject: `Invoice ${invoice.invoice_number} from ECRAFTZ`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h2 style="color: #0f172a; margin-bottom: 20px;">Invoice: ${invoice.invoice_number}</h2>
                <p>Hello <strong>${invoice.client.name}</strong>,</p>
                <p>Please find the invoice <strong>${invoice.invoice_number}</strong> attached to this email as a PDF document.</p>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #2563eb;">
                  <p style="margin: 0; color: #64748b; font-size: 14px;">Amount Due</p>
                  <p style="margin: 5px 0; font-size: 24px; font-weight: bold; color: #0f172a;">₹${invoice.grand_total.toLocaleString()}</p>
                  <p style="margin: 5px 0; font-size: 14px; color: #64748b;">Due Date: ${invoice.due_date ? format(new Date(invoice.due_date), 'MMMM dd, yyyy') : 'N/A'}</p>
                </div>
                <p>If you have any questions, please reply to this email.</p>
                <br/>
                <p>Thank you for your business!</p>
                <p><strong>- ECRAFTZ Team</strong></p>
              </div>
            `,
            attachments: [
              {
                filename: `Invoice-${invoice.invoice_number}.pdf`,
                content: pdfBase64
              }
            ]
          });
          emailDispatched = true;
        } catch (emailErr: any) {
          console.warn("Email dispatch failed.", emailErr);
          toast.info("Invoice marked as sent in DB, but email delivery encountered an issue.");
        }
      } else {
        toast.info("Client has no email address on file. Marked as sent manually.");
      }

      await updateInvoiceStatus(invoice.id, 'sent');
      setInvoice({ ...invoice, status: 'sent' });
      
      if (emailDispatched) {
        toast.success(`Invoice and PDF attachment emailed to ${invoice.client?.email} successfully!`);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update invoice status.");
    } finally {
      setIsSending(false);
    }
  }

  const invoiceData = {
    invoice_number: invoice.invoice_number,
    issued_at: (invoice.date || invoice.created_at),
    due_date: invoice.due_date,
    status: invoice.status as any,
    currency: 'INR',
    items: [
      {
        id: '1',
        description: invoice.project?.name || "IT Services & Consulting",
        quantity: 1,
        rate: invoice.grand_total,
        taxRate: invoice.tax_rate || 0
      }
    ],
    client: {
      name: invoice.client?.name || 'Unknown Client',
      email: invoice.client?.email || '',
      address: invoice.client?.address
    },
    project: {
      name: invoice.project?.name || 'General Project',
      service_type: 'Software Development',
      billing_type: invoice.is_recurring ? 'Subscription' : 'Fixed Rate'
    },
    paid_amount: invoice.paid_amount
  };

  return (
    <PageWrapper 
      title={`Invoice ${invoice.invoice_number}`} 
      description="Review and manage invoice details."
      className="max-w-6xl mx-auto print:p-0"
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
            variant="outline" 
            onClick={() => {
              import('@/lib/exportUtils').then(({ exportInvoiceToPDF }) => {
                exportInvoiceToPDF(invoice)
                toast.success('Invoice exported to PDF successfully.')
              })
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
          <Button 
            onClick={handleSendToClient} 
            disabled={isSending || invoice.status === 'sent' || invoice.status === 'paid'}
          >
            <Mail className="h-4 w-4 mr-2" />
            {isSending ? "Sending..." : invoice.status === 'sent' ? "Already Sent" : invoice.status === 'paid' ? "Already Paid" : "Send to Client"}
          </Button>
          {invoice.status !== 'paid' && (
            <Button 
              variant="default"
              className="bg-emerald-600 hover:bg-emerald-700 font-bold"
              onClick={() => setIsSignatureOpen(true)}
            >
              <PenTool className="h-4 w-4 mr-2" />
              Sign & Approve
            </Button>
          )}
        </div>
      }
    >
      <ProfessionalInvoice data={invoiceData} />

      {invoice.signature_data && (
        <div className="mt-8 p-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-black text-emerald-500 uppercase tracking-widest">Digitally Signed & Approved</p>
              <p className="text-xs text-muted-foreground font-medium">
                Signed by <span className="text-foreground font-bold">{invoice.signer_name}</span> on {invoice.signed_at ? format(new Date(invoice.signed_at), 'PPP pp') : 'N/A'}
              </p>
            </div>
          </div>
          <div className="text-right font-mono text-[10px] text-muted-foreground opacity-50">
            Audit ID: {invoice.id.split('-')[0].toUpperCase()}
            <br />
            {invoice.signature_data}
          </div>
        </div>
      )}
      
      <div className="mt-12 space-y-8 print:hidden">
        <Separator />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Paperclip className="h-5 w-5 text-primary" />
              Invoice Documents
            </h3>
            <p className="text-sm text-muted-foreground">
              Attach signed contracts, payment receipts, or other supporting documents for this invoice.
            </p>
            <FileUploadZone 
              relatedId={invoice.id}
              relatedType="invoice"
              bucket="invoices"
            />
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Related Files</h3>
            <AttachmentList 
              relatedId={invoice.id}
              relatedType="invoice"
            />
          </div>
        </div>

        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <PaymentVerificationList invoiceId={invoice.id} />
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Modification History</h3>
            <VersionHistoryTimeline entityType="invoice" entityId={invoice.id} />
          </div>
        </div>
      </div>

      <SignatureDialog 
        open={isSignatureOpen}
        onOpenChange={setIsSignatureOpen}
        documentName={`Invoice ${invoice.invoice_number}`}
        onSign={async (data) => {
          try {
            await useBillingStore.getState().signInvoice(invoice.id, data)
            const updated = await getInvoiceById(invoice.id)
            setInvoice(updated)
            toast.success("Invoice signed and approved successfully!")
          } catch (err) {
            toast.error("Failed to sign invoice")
          }
        }}
      />
    </PageWrapper>
  )
}
