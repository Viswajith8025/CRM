import { useEffect, useState } from "react"
import { useBillingStore } from "../billingStore"
import { format } from "date-fns"
import { CheckCircle2, XCircle, Clock, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { toast } from "sonner"
import type { Payment } from "../types"

export function PaymentVerificationList({ invoiceId }: { invoiceId: string }) {
  const { payments, fetchPayments, verifyPayment } = useBillingStore()
  const [isVerifying, setIsVerifying] = useState<string | null>(null)

  useEffect(() => {
    fetchPayments()
  }, [])

  const invoicePayments = payments.filter(p => p.invoice_id === invoiceId)

  if (invoicePayments.length === 0) return null

  const handleVerify = async (paymentId: string) => {
    setIsVerifying(paymentId)
    try {
      await verifyPayment(paymentId)
      toast.success("Payment verified successfully!")
    } catch (err: any) {
      toast.error(err.message || "Failed to verify payment")
    } finally {
      setIsVerifying(null)
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Payment History</h3>
      <div className="border rounded-xl bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoicePayments.map(p => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  {format(new Date(p.paid_at), 'PPP')}
                </TableCell>
                <TableCell>₹{p.amount.toLocaleString()}</TableCell>
                <TableCell className="capitalize">{p.payment_method}</TableCell>
                <TableCell>
                  {p.status === 'verified' && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Verified
                    </Badge>
                  )}
                  {p.status === 'pending' && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                      <Clock className="w-3.5 h-3.5 mr-1" /> Pending
                    </Badge>
                  )}
                  {p.status === 'failed' && (
                    <Badge variant="outline" className="bg-rose-500/10 text-rose-500 border-rose-500/20">
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Failed
                    </Badge>
                  )}
                  {!p.status && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Legacy/Paid
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {p.status === 'pending' && (
                    <Button 
                      size="sm" 
                      onClick={() => handleVerify(p.id)}
                      disabled={isVerifying === p.id}
                      className="h-8"
                    >
                      {isVerifying === p.id ? "Verifying..." : "Verify Payment"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
