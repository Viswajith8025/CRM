import { useEffect } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Plus, Download, Filter, TrendingUp } from "lucide-react"
import { InvoiceList } from "../components/InvoiceList"
import { useBillingStore } from "../billingStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function BillingPage() {
  const { fetchInvoices, invoices } = useBillingStore()

  useEffect(() => {
    fetchInvoices()
  }, [])

  const totalInvoiced = invoices.reduce((acc, curr) => acc + curr.amount, 0)
  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((acc, curr) => acc + curr.amount, 0)
  const outstanding = totalInvoiced - totalPaid

  return (
    <PageWrapper 
      title="Billing & Invoices" 
      description="Manage client invoicing, payments, and financial history."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Invoice
          </Button>
        </div>
      }
    >
      <div className="grid gap-6 sm:grid-cols-3 mb-8">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Invoiced</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalInvoiced.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Paid</CardTitle>
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">${totalPaid.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-rose-500/5 border-rose-500/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-rose-600 dark:text-rose-400">Outstanding</CardTitle>
            <div className="h-2 w-2 rounded-full bg-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">${outstanding.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Invoices</h3>
          <Button variant="ghost" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filter
          </Button>
        </div>
        <InvoiceList />
      </div>
    </PageWrapper>
  )
}
