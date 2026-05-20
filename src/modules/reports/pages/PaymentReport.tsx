
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { CreditCard, CheckCircle, Clock, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function PaymentReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRowAction = (action: RowAction, item: any) => {
    const reference = item.invoice?.invoice_number || 'Payment'
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed audit for payment ${reference}`)
        ReportExportService.exportSingleRecord(
          `Payment Receipt - ${reference}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Redirecting to billing for reconciliation`)
        navigate(`/billing?search=${encodeURIComponent(reference)}`)
        break
      case 'download':
        toast.success(`Exporting row data...`)
        ReportExportService.exportToCSV({
          title: "Payment_Record_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Financial records are strictly immutable.`)
        break
    }
  }
  
  const { 
    data: payments, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch 
  } = useReport<any>({
    tableName: 'payments',
    select: '*, invoice:invoices(invoice_number, client:clients(name))',
    pageSize: 20,
    searchFields: ['amount', 'payment_method', 'status'],
    defaultSortBy: 'paid_at'
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Verified', value: 'verified' },
        { label: 'Failed', value: 'failed' },
      ]
    },
    {
      label: 'Method',
      value: 'payment_method',
      type: 'select',
      options: [
        { label: 'Bank Transfer', value: 'bank_transfer' },
        { label: 'Credit Card', value: 'credit_card' },
        { label: 'Cash', value: 'cash' },
        { label: 'PayPal', value: 'paypal' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Payment Date', 
      accessorKey: 'paid_at',
      cell: (item) => (
        <div className="text-[11px] font-medium">
          {item.paid_at ? format(new Date(item.paid_at), 'MMM d, yyyy') : 'N/A'}
        </div>
      )
    },
    { 
      header: 'Reference', 
      accessorKey: 'invoice',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold text-xs">{item.invoice?.invoice_number || 'Direct Payment'}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">{item.invoice?.client?.name || 'Walk-in Client'}</span>
        </div>
      )
    },
    { 
      header: 'Amount', 
      accessorKey: 'amount',
      cell: (item) => <span className="font-black text-emerald-600">₹{Number(item.amount || 0).toLocaleString()}</span>
    },
    { 
      header: 'Method', 
      accessorKey: 'payment_method',
      cell: (item) => <span className="text-[10px] font-bold uppercase tracking-widest">{item.payment_method?.replace('_', ' ')}</span>
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'verified' ? 'default' : item.status === 'failed' ? 'destructive' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const totalVerified = payments.filter(p => p.status === 'verified').reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const pendingAmount = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount || 0), 0)
    const failedCount = payments.filter(p => p.status === 'failed').length

    return [
      {
        label: 'Total Collected',
        value: `₹${totalVerified.toLocaleString()}`,
        icon: CheckCircle,
        description: 'Verified funds'
      },
      {
        label: 'In-Transit',
        value: `₹${pendingAmount.toLocaleString()}`,
        icon: Clock,
        description: 'Pending verification'
      },
      {
        label: 'Payment Attempts',
        value: totalCount,
        icon: CreditCard,
        description: 'Total transactions'
      },
      {
        label: 'Failed Deposits',
        value: failedCount,
        icon: AlertCircle,
        description: 'Bounced or declined'
      }
    ]
  }, [payments, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Consolidated Payment Audit",
      subtitle: "Official record of verified cash inflows, transaction statuses, and reconciliation data.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Date', dataKey: 'paid_at' },
        { header: 'Amount', dataKey: 'amount' },
        { header: 'Method', dataKey: 'payment_method' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: payments,
      summary: {
        'Verified Funds': summaryMetrics[0].value,
        'Pending Amount': summaryMetrics[1].value,
        'Total Records': totalCount
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Financial Center: Payment Records"
        description="Audit-ready payment reconciliation logs, verification timestamps, and institutional cashflow tracking."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Payment_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Date', dataKey: 'paid_at' },
            { header: 'Amount', dataKey: 'amount' },
            { header: 'Method', dataKey: 'payment_method' },
            { header: 'Status', dataKey: 'status' }
          ],
          data: payments
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search payments by reference or amount..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={payments}
          isLoading={isLoading}
          totalCount={totalCount}
          page={page}
          limit={20}
          onPageChange={setPage}
          onRowAction={handleRowAction}
        />
      </div>
    </div>
  )
}
