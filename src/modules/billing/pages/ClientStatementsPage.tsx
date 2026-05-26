import { useEffect, useState, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
import { supabase } from "@/lib/supabase"
import { useCRMStore } from "@/modules/crm/crmStore"
import { useBillingStore } from "@/modules/billing/billingStore"
import { useAuthStore } from "@/store/useAuthStore"
import { 
  FileText, 
  DollarSign, 
  Clock, 
  ArrowUpRight, 
  Calendar, 
  ChevronRight, 
  Printer, 
  Plus, 
  CreditCard,
  Building,
  CheckCircle,
  HelpCircle,
  Download,
  Mail
} from "lucide-react"
import { format } from "date-fns"

interface StatementEntry {
  id: string
  entry_type: "invoice" | "payment" | "refund" | "adjustment"
  entry_date: string
  reference_number: string
  debit: number
  credit: number
  running_balance: number
  description: string
}

interface BalanceSummary {
  total_billed: number
  total_received: number
  overdue_amount: number
  advance_balance: number
  outstanding_balance: number
}

export default function ClientStatementsPage() {
  const { clients, fetchClients } = useCRMStore()
  const { invoices, fetchInvoices } = useBillingStore()
  const { profile } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const selectedClientId = searchParams.get("clientId") || ""
  
  const [statement, setStatement] = useState<StatementEntry[]>([])
  const [balance, setBalance] = useState<BalanceSummary | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPaymentOpen, setIsPaymentOpen] = useState(false)

  // Payment Form Fields
  const [amount, setAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState<string>("bank_transfer")
  const [transactionId, setTransactionId] = useState("")
  const [notes, setNotes] = useState("")
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string>("none")
  const [isSending, setIsSending] = useState(false)

  // Load clients and billing invoices
  useEffect(() => {
    fetchClients()
    fetchInvoices({ force: true })
  }, [])

  // Load Client Statements and Balance Summaries
  const loadClientFinanceData = async (clientIdToLoad: string) => {
    if (!clientIdToLoad) {
      setStatement([])
      setBalance(null)
      return
    }

    setIsLoading(true)
    try {
      // 1. Fetch Invoices for this client
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .select("*")
        .eq("client_id", clientIdToLoad)
        .is("deleted_at", null);

      if (invErr) throw invErr;

      // 2. Fetch Payments for this client
      const { data: payData, error: payErr } = await supabase
        .from("client_payments")
        .select("*")
        .eq("client_id", clientIdToLoad);

      if (payErr) throw payErr;

      // 3. Transform to Statement entries
      const invoiceEntries: StatementEntry[] = (invData || []).map(inv => ({
        id: inv.id,
        entry_type: "invoice",
        entry_date: inv.created_at || inv.issued_at || new Date().toISOString(),
        reference_number: inv.invoice_number,
        debit: Number(inv.amount),
        credit: 0,
        running_balance: 0,
        description: `Invoice generated: ${inv.invoice_number}`
      }));

      const paymentEntries: StatementEntry[] = (payData || []).map(pay => ({
        id: pay.id,
        entry_type: "payment",
        entry_date: pay.payment_date || pay.created_at || new Date().toISOString(),
        reference_number: `PAY-${pay.id.substring(0, 6).toUpperCase()}`,
        debit: 0,
        credit: Number(pay.amount),
        running_balance: 0,
        description: `Payment received via ${pay.payment_method.toUpperCase().replace('_', ' ')} (Txn ID: ${pay.transaction_id || 'N/A'})`
      }));

      // 4. Merge and sort chronologically
      const mergedEntries = [...invoiceEntries, ...paymentEntries].sort(
        (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime()
      );

      // 5. Calculate running balance
      let runningBalance = 0;
      const statementEntries = mergedEntries.map(entry => {
        runningBalance = runningBalance + entry.debit - entry.credit;
        return {
          ...entry,
          running_balance: runningBalance
        };
      });

      setStatement(statementEntries);

      // 6. Calculate Balance Summary
      const total_billed = (invData || []).reduce((sum, inv) => sum + Number(inv.amount), 0);
      const total_received = (payData || []).reduce((sum, pay) => sum + Number(pay.amount), 0);
      
      const todayStr = new Date().toISOString().split('T')[0];
      const overdue_amount = (invData || [])
        .filter(inv => inv.status === 'overdue' || (inv.status !== 'paid' && inv.due_date < todayStr))
        .reduce((sum, inv) => sum + Number(inv.amount), 0);

      const outstanding_balance = total_billed - total_received;
      const advance_balance = total_received > total_billed ? total_received - total_billed : 0;

      setBalance({
        total_billed,
        total_received,
        overdue_amount,
        advance_balance,
        outstanding_balance
      });

    } catch (err: any) {
      console.error("Statement loading error:", err)
      toast.error("Failed to load customer statements.")
    } finally {
      setIsLoading(false)
    }
  }

  // Load Client Statements and Balance Summaries
  useEffect(() => {
    loadClientFinanceData(selectedClientId)
  }, [selectedClientId])

  // Get Invoices for the currently selected client
  const clientInvoices = useMemo(() => {
    return invoices.filter(inv => inv.client_id === selectedClientId)
  }, [invoices, selectedClientId])

  const handleClientChange = (id: string) => {
    setSearchParams({ clientId: id })
  }

  // Handle Payment Entry Creation
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClientId) return
    const payAmount = parseFloat(amount)
    if (isNaN(payAmount) || payAmount <= 0) {
      toast.error("Please specify a valid payment amount greater than zero.")
      return
    }

    setIsLoading(true)
    try {
      const orgId = profile?.organization_id
      if (!orgId) throw new Error("No organization context found.")

      // 1. Insert into client_payments
      const { data: paymentData, error: paymentErr } = await supabase
        .from("client_payments")
        .insert({
          organization_id: orgId,
          client_id: selectedClientId,
          amount: payAmount,
          payment_method: paymentMethod,
          transaction_id: transactionId || null,
          notes: notes || null,
          created_by: profile?.id,
        })
        .select()
        .single()

      if (paymentErr) throw paymentErr

      // 2. Insert invoice allocation if selected
      if (linkedInvoiceId !== "none") {
        const { error: allocErr } = await supabase
          .from("payment_allocations")
          .insert({
            organization_id: orgId,
            payment_id: paymentData.id,
            invoice_id: linkedInvoiceId,
            amount_allocated: payAmount,
          })

        if (allocErr) throw allocErr

        // Update the invoice status as paid or partially paid
        const targetInvoice = invoices.find(i => i.id === linkedInvoiceId)
        if (targetInvoice) {
          const unpaid = targetInvoice.grand_total - payAmount
          const newStatus = unpaid <= 0 ? "paid" : "sent"
          await supabase
            .from("invoices")
            .update({ status: newStatus })
            .eq("id", linkedInvoiceId)
        }
      }

      toast.success("Payment recorded successfully! Statements recalculated in real-time.")
      setIsPaymentOpen(false)
      
      // Reset form
      setAmount("")
      setTransactionId("")
      setNotes("")
      setLinkedInvoiceId("none")

      // Force refresh data
      fetchInvoices({ force: true })
      // Re-trigger real-time calculation
      await loadClientFinanceData(selectedClientId)

    } catch (err: any) {
      console.error("Payment registration error:", err)
      toast.error(err.message || "Failed to record client payment.")
    } finally {
      setIsLoading(false)
    }
  }

  const printStatement = () => {
    window.print()
  }

  const exportCSV = () => {
    if (!selectedClient || statement.length === 0) {
      toast.error("No statement entries to export.")
      return
    }

    const headers = ["Transaction Date", "Reference", "Description", "Debit (Billed)", "Credit (Paid)", "Running Balance"]
    const rows = statement.map(entry => [
      format(new Date(entry.entry_date), "yyyy-MM-dd HH:mm"),
      entry.reference_number,
      entry.description ? entry.description.replace(/"/g, '""') : "",
      entry.debit,
      entry.credit,
      entry.running_balance
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(val => `"${val}"`).join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `ledger_statement_${selectedClient.name.toLowerCase().replace(/\s+/g, "_")}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Ledger statement CSV exported successfully!")
  }
  const selectedClient = clients.find(c => c.id === selectedClientId)

  const handleSendStatement = async () => {
    if (!selectedClient || statement.length === 0) {
      toast.error("No statement entries to send.")
      return
    }

    if (!selectedClient.email) {
      toast.error("This client does not have an email address on file.")
      return
    }

    setIsSending(true)
    try {
      const headers = ["Transaction Date", "Reference", "Description", "Debit (Billed)", "Credit (Paid)", "Running Balance"]
      const rows = statement.map(entry => [
        format(new Date(entry.entry_date), "yyyy-MM-dd HH:mm"),
        entry.reference_number,
        entry.description ? entry.description.replace(/"/g, '""') : "",
        entry.debit,
        entry.credit,
        entry.running_balance
      ])

      const csvContent = [
        headers.join(","),
        ...rows.map(r => r.map(val => `"${val}"`).join(","))
      ].join("\n")
      
      const csvBase64 = btoa(csvContent)

      const { sendEmail } = await import('@/lib/email')
      
      await sendEmail({
        to: selectedClient.email,
        subject: `Account Statement - ${selectedClient.name}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #0f172a; margin-bottom: 20px;">Account Statement</h2>
            <p>Hello <strong>${selectedClient.name}</strong>,</p>
            <p>Please find your up-to-date account ledger statement attached to this email as a CSV file.</p>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #2563eb;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">Outstanding Balance</p>
              <p style="margin: 5px 0; font-size: 24px; font-weight: bold; color: #0f172a;">₹${balance?.outstanding_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            </div>
            <p>If you have any questions, please reply to this email.</p>
            <p style="margin-top: 30px; font-size: 12px; color: #94a3b8;">
              This is an automated message from your service provider.
            </p>
            <p>Thank you for your business!</p>
            <p><strong>- ECRAFTZ Team</strong></p>
          </div>
        `,
        attachments: [
          {
            filename: `Statement_${selectedClient.name.replace(/\s+/g, "_")}.csv`,
            content: csvBase64,
            encoding: "base64"
          }
        ]
      })

      toast.success(`Statement emailed to ${selectedClient.email} successfully!`)
    } catch (err: any) {
      toast.error(err.message || "Failed to send statement email.")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <PageWrapper
      title="Client Statements"
      description="Interactive multi-tenant customer ledger timeline. Track billing debits, receipts, advances, and balances."
      actions={
        <div className="flex gap-2 no-print">
          <Button
            variant="outline"
            className="gap-2 border-border/60 font-semibold"
            onClick={printStatement}
            disabled={!selectedClientId}
          >
            <Printer className="h-4 w-4" /> Print Ledger
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-border/60 font-semibold text-primary"
            onClick={exportCSV}
            disabled={!selectedClientId || statement.length === 0}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button
            variant="outline"
            className="gap-2 border-border/60 font-semibold text-sky-600"
            onClick={handleSendStatement}
            disabled={!selectedClientId || statement.length === 0 || isSending}
          >
            <Mail className="h-4 w-4" /> {isSending ? "Sending..." : "Email Statement"}
          </Button>
          <Button
            className="gap-2 font-bold"
            disabled={!selectedClientId}
            onClick={() => setIsPaymentOpen(true)}
          >
            <Plus className="h-4 w-4" /> Record Payment
          </Button>
        </div>
      }
    >
      {/* CSS print utility for clean corporate invoice-style generation */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 1.5rem;
            color: #000 !important;
            background: #fff !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            background: transparent !important;
          }
        }
      `}</style>

      <div className="space-y-6">
        {/* Client Selector (Hidden on Print) */}
        <div className="p-6 rounded-2xl border border-border/50 bg-card/30 flex flex-col md:flex-row gap-4 justify-between items-center no-print">
          <div className="space-y-1 w-full md:w-1/2">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Active Client</Label>
            <Select value={selectedClientId} onValueChange={handleClientChange}>
              <SelectTrigger className="bg-background shadow-sm border-border/60">
                <SelectValue placeholder="Choose a client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.email || "No Email"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {!selectedClientId ? (
              <p className="italic">Select a client context to generate double-entry ledgers.</p>
            ) : (
              <p className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 justify-end">
                <CheckCircle className="h-4 w-4" /> Statements Synchronized Real-time
              </p>
            )}
          </div>
        </div>

        {selectedClientId ? (
          <div className="print-area space-y-6">
            
            {/* Print Header Block */}
            <div className="hidden print:flex justify-between items-start border-b border-gray-300 pb-6">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-gray-900">ECRAFTZ OPERATIONAL ERP</h1>
                <p className="text-xs text-gray-500">Corporate Customer Financial Statements Ledger</p>
                <p className="text-xs text-gray-500 mt-1">Generated: {format(new Date(), "PPpp")}</p>
              </div>
              <div className="text-right">
                <h2 className="text-sm font-bold text-gray-800">{selectedClient?.name}</h2>
                <p className="text-xs text-gray-500">{selectedClient?.email}</p>
                <p className="text-xs text-gray-500">{selectedClient?.address || "Address Not Configured"}</p>
              </div>
            </div>

            {/* Balances Board */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
              <Card className="border-border/50 bg-card/30 print-card">
                <CardHeader className="p-4 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Invoiced</span>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl md:text-2xl font-black tracking-tight">
                    ₹{balance?.total_billed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/30 print-card">
                <CardHeader className="p-4 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Received</span>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl md:text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                    ₹{balance?.total_received.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/30 print-card">
                <CardHeader className="p-4 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Advance Credit</span>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl md:text-2xl font-black tracking-tight text-sky-600 dark:text-sky-400">
                    ₹{balance?.advance_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/30 print-card">
                <CardHeader className="p-4 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Overdue Unpaid</span>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl md:text-2xl font-black tracking-tight text-rose-600 dark:text-rose-400">
                    ₹{balance?.overdue_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>

              <Card className="col-span-2 md:col-span-1 border-primary/20 bg-primary/5 dark:bg-primary/10 shadow-sm print-card">
                <CardHeader className="p-4 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary">Outstanding Balance</span>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-xl md:text-2xl font-black tracking-tight text-primary">
                    ₹{balance?.outstanding_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Interactive Timeline Ledger Ledger */}
            <Card className="border-border/60 print-card">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-md font-bold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" /> Chronological Statements Journal
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground text-[10px] font-black uppercase tracking-wider">
                        <th className="p-4">Transaction Date</th>
                        <th className="p-4">Reference</th>
                        <th className="p-4">Description</th>
                        <th className="p-4 text-right">Debit (Billed)</th>
                        <th className="p-4 text-right">Credit (Paid)</th>
                        <th className="p-4 text-right bg-primary/5">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {statement.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground italic">
                            No billing or payment records found for this account.
                          </td>
                        </tr>
                      ) : (
                        statement.map((entry) => {
                          const isPayment = entry.entry_type === "payment"
                          return (
                            <tr 
                              key={entry.id}
                              className={`hover:bg-muted/30 transition-colors ${
                                isPayment ? "bg-emerald-500/5 dark:bg-emerald-500/10" : ""
                              }`}
                            >
                              <td className="p-4 font-medium text-xs whitespace-nowrap">
                                {format(new Date(entry.entry_date), "dd MMM yyyy HH:mm")}
                              </td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-muted tracking-wide">
                                  {entry.reference_number}
                                </span>
                              </td>
                              <td className="p-4 text-xs font-semibold text-muted-foreground max-w-xs md:max-w-md truncate">
                                {entry.description}
                              </td>
                              <td className="p-4 text-right text-xs font-bold">
                                {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : "—"}
                              </td>
                              <td className="p-4 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : "—"}
                              </td>
                              <td className={`p-4 text-right text-xs font-black bg-primary/5 ${
                                entry.running_balance > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                              }`}>
                                ₹{entry.running_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 border border-dashed border-border/80 rounded-2xl bg-card/10">
            <HelpCircle className="h-10 w-10 text-muted-foreground mb-3 animate-pulse" />
            <h3 className="text-md font-black tracking-tight mb-1 text-muted-foreground">No Ledger Selected</h3>
            <p className="text-xs text-muted-foreground/80 max-w-sm text-center">
              Please choose a customer from the dropdown selector above to analyze their real-time chronological ERP accounting statements.
            </p>
          </div>
        )}
      </div>

      {/* Record Payment Dialog */}
      <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" /> Record Client Receipt
            </DialogTitle>
            <DialogDescription>
              Submit custom payments directly into the double-entry accounting ledger. Balance summaries will recalculate transaction queues automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRecordPayment} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider">Payment Receipt Amount (₹)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0.00"
                  className="pl-9 font-bold"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider">Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer / NEFT</SelectItem>
                    <SelectItem value="upi">UPI / Scanner</SelectItem>
                    <SelectItem value="cash">Cash Payment</SelectItem>
                    <SelectItem value="card">Credit/Debit Card</SelectItem>
                    <SelectItem value="cheque">Cheque Deposit</SelectItem>
                    <SelectItem value="online_gateway">Online Stripe Gateway</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-wider">Transaction / Reference ID</Label>
                <Input
                  placeholder="TXN91823901"
                  value={transactionId}
                  onChange={e => setTransactionId(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider">Allocate Payment to Invoice (Optional)</Label>
              <Select value={linkedInvoiceId} onValueChange={setLinkedInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose target invoice..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Specific Invoice (Advance Deposit)</SelectItem>
                  {clientInvoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} (₹{inv.amount.toLocaleString()} — {inv.status.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-wider">Private Ledger Notes</Label>
              <Input
                placeholder="e.g. Q2 advance payment milestone"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-border/40">
              <Button type="button" variant="ghost" onClick={() => setIsPaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="font-bold">
                {isLoading ? "Recalculating..." : "Post Payment Receipt"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
