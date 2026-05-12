import { useState, useMemo } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { FileText, DollarSign, Clock, AlertCircle, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { exportToCSV } from "@/lib/exportUtils"
import { toast } from "sonner"

export default function InvoiceReport() {
  const { 
    data: invoices, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    setFilters, 
    setSearch, 
    setSort,
    filters 
  } = useReport<any>({
    tableName: 'invoices',
    select: '*, client:profiles(full_name, email)',
    pageSize: 15
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Paid', value: 'paid' },
        { label: 'Sent', value: 'sent' },
        { label: 'Overdue', value: 'overdue' },
        { label: 'Draft', value: 'draft' },
      ]
    },
    {
      label: 'Date Range',
      value: 'issued_at',
      type: 'date'
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Invoice #', 
      accessorKey: 'invoice_number',
      cell: (item) => <span className="font-black text-primary">#{item.invoice_number}</span>,
      sortable: true
    },
    { 
      header: 'Client', 
      accessorKey: 'client',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.client?.full_name || 'N/A'}</span>
          <span className="text-[10px] text-muted-foreground">{item.client?.email}</span>
        </div>
      )
    },
    { 
      header: 'Amount', 
      accessorKey: 'amount',
      cell: (item) => <span className="font-black">${item.amount?.toLocaleString()}</span>,
      sortable: true
    },
    { 
      header: 'Date', 
      accessorKey: 'issued_at',
      cell: (item) => format(new Date(item.issued_at), 'MMM dd, yyyy'),
      sortable: true
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge variant={item.status === 'paid' ? 'default' : 'secondary'} className="text-[10px] uppercase font-black tracking-widest">
          {item.status}
        </Badge>
      ),
      sortable: true
    }
  ]

  const summaryMetrics = useMemo(() => {
    const totalRevenue = invoices
      .filter((i: any) => i.status === 'paid')
      .reduce((sum: number, i: any) => sum + Number(i.amount), 0)
    
    const pendingAmount = invoices
      .filter((i: any) => i.status === 'sent' || i.status === 'overdue')
      .reduce((sum: number, i: any) => sum + Number(i.amount), 0)

    return [
      {
        label: 'Total Invoiced',
        value: `₹${(totalRevenue + pendingAmount).toLocaleString()}`,
        icon: FileText,
        color: 'primary',
        description: 'Total billables in period'
      },
      {
        label: 'Total Paid',
        value: `₹${totalRevenue.toLocaleString()}`,
        icon: DollarSign,
        color: 'emerald',
        description: 'Actual collected revenue'
      },
      {
        label: 'Total Pending',
        value: `₹${pendingAmount.toLocaleString()}`,
        icon: Clock,
        color: 'blue',
        description: 'Outstanding balance'
      },
      {
        label: 'Overdue Amount',
        value: `₹${invoices.filter((i: any) => i.status === 'overdue').reduce((sum: number, i: any) => sum + Number(i.amount), 0).toLocaleString()}`,
        icon: AlertCircle,
        color: 'rose',
        description: 'Critical past due'
      }
    ]
  }, [invoices])

  const handleExportCSV = () => {
    const exportData = invoices.map((inv: any) => ({
      Invoice_No: inv.invoice_number,
      Client: inv.client?.full_name,
      Amount: inv.amount,
      Status: inv.status,
      Issued_At: inv.issued_at
    }))
    exportToCSV(exportData, `Invoice_Audit_${format(new Date(), 'yyyy-MM-dd')}`)
    toast.success("CSV Export started")
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <ReportHeader 
        title="Institutional Billing Audit"
        description="Comprehensive financial record of all generated invoices, payment statuses, and client billing history."
        onExportCSV={handleExportCSV}
        onPrint={() => window.print()}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        title="Billing Records by Client"
        description="Detailed view and download of client invoices and payment status"
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        onExportCSV={handleExportCSV}
        onExportPDF={() => toast.info("PDF Engine initializing...")}
        searchPlaceholder="Search invoices..."
      />

      <div className="px-8 py-4">
        <ReportTable 
          columns={columns}
          data={invoices}
          isLoading={isLoading}
          totalCount={totalCount}
          page={page}
          limit={15}
          onPageChange={setPage}
          onSort={(key, order) => setSort({ key, order })}
        />
      </div>
    </div>
  )
}
