import { useEffect } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useBillingStore } from "@/modules/billing"
import { InvoiceList } from "@/modules/billing/components/InvoiceList"

export default function ClientInvoices() {
  const { fetchInvoices } = useBillingStore()

  useEffect(() => {
    fetchInvoices()
  }, [])

  return (
    <PageWrapper 
      title="My Invoices" 
      description="View and manage your billing history."
    >
      <div className="space-y-4">
        <InvoiceList />
      </div>
    </PageWrapper>
  )
}
