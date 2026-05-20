
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { FileText, DollarSign, Clock, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

import { useNavigate } from "react-router-dom"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function InvoiceReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed audit for invoice ${item.invoice_number}`)
        ReportExportService.exportSingleRecord(
          `Invoice Audit - ${item.invoice_number}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Redirecting to billing for ${item.invoice_number}`)
        navigate(`/billing?search=${encodeURIComponent(item.invoice_number || '')}`)
        break
      case 'download':
        toast.success(`Exporting row data for ${item.invoice_number}`)
        ReportExportService.exportToCSV({
          title: "Single_Invoice_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Invoices cannot be deleted from the reporting view for audit integrity.`)
        break
    }
  }
  
  const { 
    data: invoices, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch 
  } = useReport<any>({
    tableName: 'invoices',
    select: '*, client:clients(name)',
    pageSize: 20
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Sent', value: 'sent' },
        { label: 'Paid', value: 'paid' },
        { label: 'Partially Paid', value: 'partially_paid' },
        { label: 'Overdue', value: 'overdue' },
        { label: 'Cancelled', value: 'cancelled' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Invoice #', 
      accessorKey: 'invoice_number',
      cell: (item) => <span className="font-black text-xs uppercase tracking-tighter">{item.invoice_number}</span>
    },
    { 
      header: 'Client', 
      accessorKey: 'client',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.client?.name || 'Manual Billing'}</span>
        </div>
      )
    },
    { 
      header: 'Due Date', 
      accessorKey: 'due_date',
      cell: (item) => (
        <div className="text-[11px] font-medium">
          {item.due_date ? format(new Date(item.due_date), 'MMM d, yyyy') : 'N/A'}
        </div>
      )
    },
    { 
      header: 'Total Amount', 
      accessorKey: 'amount',
      cell: (item) => <span className="font-black text-foreground">₹{Number(item.amount || 0).toLocaleString()}</span>
    },
    { 
      header: 'Paid', 
      accessorKey: 'paid_amount',
      cell: (item) => <span className="font-bold text-emerald-600">₹{Number(item.paid_amount || 0).toLocaleString()}</span>
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'paid' ? 'default' : item.status === 'overdue' ? 'destructive' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status?.replace('_', ' ')}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount || 0), 0)
    const pendingRevenue = invoices.filter(i => ['sent', 'partially_paid'].includes(i.status)).reduce((sum, i) => sum + (Number(i.amount || 0) - Number(i.paid_amount || 0)), 0)
    const overdueCount = invoices.filter(i => i.status === 'overdue').length

    return [
      {
        label: 'Total Billing',
        value: totalCount,
        icon: FileText,
        description: 'Total invoices generated'
      },
      {
        label: 'Verified Revenue',
        value: `₹${totalRevenue.toLocaleString()}`,
        icon: DollarSign,
        description: 'Settled accounts'
      },
      {
        label: 'Awaiting Payment',
        value: `₹${pendingRevenue.toLocaleString()}`,
        icon: Clock,
        description: 'Projected cashflow'
      },
      {
        label: 'Critical Overdue',
        value: overdueCount,
        icon: AlertTriangle,
        description: 'Immediate action required'
      }
    ]
  }, [invoices, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Accounts Receivable Audit",
      subtitle: "Detailed chronological record of institutional invoicing and payment status.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Invoice #', dataKey: 'invoice_number' },
        { header: 'Client', dataKey: 'client_id' },
        { header: 'Amount', dataKey: 'amount' },
        { header: 'Paid', dataKey: 'paid_amount' },
        { header: 'Due Date', dataKey: 'due_date' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: invoices,
      summary: {
        'Total Invoices': totalCount,
        'Revenue Paid': summaryMetrics[1].value,
        'Revenue Pending': summaryMetrics[2].value,
        'Overdue Count': summaryMetrics[3].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Financial Center: Invoices"
        description="Comprehensive audit of all accounts receivable, partial payments, and overdue liability tracking."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Invoice_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Invoice #', dataKey: 'invoice_number' },
            { header: 'Amount', dataKey: 'amount' },
            { header: 'Paid', dataKey: 'paid_amount' },
            { header: 'Status', dataKey: 'status' },
            { header: 'Due Date', dataKey: 'due_date' }
          ],
          data: invoices
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search by invoice number or client..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={invoices}
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
