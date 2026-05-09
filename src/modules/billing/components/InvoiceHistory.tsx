import { useEffect, useState } from "react"
import { useBillingStore } from "../billingStore"
import { formatDistanceToNow, format } from "date-fns"
import { History, FileText } from "lucide-react"

export function InvoiceHistory({ invoiceId }: { invoiceId: string }) {
  const { fetchInvoiceRevisions } = useBillingStore()
  const [revisions, setRevisions] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const data = await fetchInvoiceRevisions(invoiceId)
      setRevisions(data)
    }
    load()
  }, [invoiceId])

  if (revisions.length === 0) return null

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        Revision History
      </h3>
      <div className="space-y-4">
        {revisions.map((rev) => (
          <div key={rev.id} className="relative flex gap-4 items-start pl-1">
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-muted border-muted-foreground/20">
              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0 pb-4 border-b border-border/40 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-bold text-foreground">
                  Version {rev.version}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(rev.created_at), { addSuffix: true })}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Saved by {rev.profiles?.full_name || "System"} on {format(new Date(rev.created_at), 'PPP pp')}
              </p>
              {/* Optional: Show what changed if needed */}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
