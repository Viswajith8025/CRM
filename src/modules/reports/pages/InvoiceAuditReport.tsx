
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { ShieldCheck, FileSearch, AlertCircle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function InvoiceAuditReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed forensic audit for invoice ${item.invoice_number}`)
        ReportExportService.exportSingleRecord(
          `Forensic Audit - ${item.invoice_number}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Redirecting to billing for reconciliation`)
        navigate(`/billing?search=${encodeURIComponent(item.invoice_number || '')}`)
        break
      case 'download':
        toast.success(`Exporting audit data...`)
        ReportExportService.exportToCSV({
          title: "Invoice_Audit_Record",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Audit records are strictly protected and cannot be deleted.`)
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
    pageSize: 20,
    defaultSortBy: 'created_at'
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
      header: 'Client Portfolio', 
      accessorKey: 'client',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.client?.name || 'Manual Entry'}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">ID: {item.client_id?.substring(0,8)}...</span>
        </div>
      )
    },
    { 
      header: 'Audit Date', 
      accessorKey: 'created_at',
      cell: (item) => (
        <div className="text-[11px] font-medium text-muted-foreground">
          {item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy HH:mm') : 'N/A'}
        </div>
      )
    },
    { 
      header: 'Face Value', 
      accessorKey: 'amount',
      cell: (item) => <span className="font-black text-foreground">${Number(item.amount || 0).toLocaleString()}</span>
    },
    { 
      header: 'Reconciled', 
      accessorKey: 'paid_amount',
      cell: (item) => <span className="font-bold text-emerald-600">${Number(item.paid_amount || 0).toLocaleString()}</span>
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'paid' ? 'default' : item.status === 'cancelled' ? 'destructive' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status?.replace('_', ' ')}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const paidCount = invoices.filter(i => i.status === 'paid').length
    const voidCount = invoices.filter(i => i.status === 'cancelled').length
    const auditAccuracy = totalCount > 0 ? (paidCount / totalCount) * 100 : 0

    return [
      {
        label: 'Total Audit Log',
        value: totalCount,
        icon: FileSearch,
        description: 'Aggregate document count'
      },
      {
        label: 'Reconciled docs',
        value: paidCount,
        icon: CheckCircle2,
        description: 'Settled accounts'
      },
      {
        label: 'Voided Invoices',
        value: voidCount,
        icon: AlertCircle,
        description: 'Cancelled liabilities'
      },
      {
        label: 'Integrity Score',
        value: `${Math.round(auditAccuracy)}%`,
        icon: ShieldCheck,
        description: 'Revenue realization'
      }
    ]
  }, [invoices, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Full Institutional Invoice Audit",
      subtitle: "Irrefutable record of all invoicing events, cancellations, and reconciliation history.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Invoice #', dataKey: 'invoice_number' },
        { header: 'Client', dataKey: 'client' },
        { header: 'Amount', dataKey: 'amount' },
        { header: 'Paid', dataKey: 'paid_amount' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Created', dataKey: 'created_at' },
      ],
      data: invoices,
      summary: {
        'Audit Entries': totalCount,
        'Settled Docs': summaryMetrics[1].value,
        'Voided Docs': summaryMetrics[2].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Finance: Invoice Audit"
        description="Forensic review of all financial documents, mutation history, and institutional revenue integrity."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Forensic_Invoice_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Invoice #', dataKey: 'invoice_number' },
            { header: 'Amount', dataKey: 'amount' },
            { header: 'Status', dataKey: 'status' },
            { header: 'Date', dataKey: 'created_at' }
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
        searchPlaceholder="Search audit log by invoice number or status..."
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
