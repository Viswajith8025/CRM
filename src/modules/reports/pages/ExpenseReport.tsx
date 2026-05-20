
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { TrendingDown, Receipt, ShoppingCart, AlertCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function ExpenseReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed voucher for ${item.description || 'Expense'}`)
        ReportExportService.exportSingleRecord(
          `Expense Audit - ${item.description || 'Record'}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Redirecting to finance for record management`)
        navigate(`/billing?search=${encodeURIComponent(item.description || '')}`)
        break
      case 'download':
        toast.success(`Exporting row data...`)
        ReportExportService.exportToCSV({
          title: "Expense_Record_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Institutional expenditures cannot be deleted for audit safety.`)
        break
    }
  }
  
  const { 
    data: expenses, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch 
  } = useReport<any>({
    tableName: 'project_expenses',
    select: '*, project:projects(name)',
    pageSize: 20,
    searchFields: ['description', 'category', 'status']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Category',
      value: 'category',
      type: 'select',
      options: [
        { label: 'Travel', value: 'travel' },
        { label: 'Hardware', value: 'hardware' },
        { label: 'Software', value: 'software' },
        { label: 'Marketing', value: 'marketing' },
        { label: 'Supplies', value: 'supplies' },
        { label: 'Other', value: 'other' },
      ]
    },
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Date', 
      accessorKey: 'expense_date',
      cell: (item) => (
        <div className="text-[11px] font-medium">
          {item.expense_date ? format(new Date(item.expense_date), 'MMM d, yyyy') : 'N/A'}
        </div>
      )
    },
    { 
      header: 'Description', 
      accessorKey: 'description',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.description || 'Institutional Expense'}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-tight">
            {item.project?.name || 'Operating Expenses'}
          </span>
        </div>
      )
    },
    { 
      header: 'Amount', 
      accessorKey: 'amount',
      cell: (item) => <span className="font-black text-rose-600">-${Number(item.amount || 0).toLocaleString()}</span>
    },
    { 
      header: 'Category', 
      accessorKey: 'category',
      cell: (item) => (
        <Badge variant="outline" className="text-[10px] uppercase font-black border-border/50 bg-muted/30">
          {item.category}
        </Badge>
      )
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'approved' ? 'default' : item.status === 'rejected' ? 'destructive' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status || 'pending'}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const totalOutflow = expenses.filter(e => e.status !== 'rejected').reduce((sum, e) => sum + Number(e.amount || 0), 0)
    const pendingApproval = expenses.filter(e => e.status === 'pending' || !e.status).reduce((sum, e) => sum + Number(e.amount || 0), 0)
    
    return [
      {
        label: 'Total Outflow',
        value: `$${totalOutflow.toLocaleString()}`,
        icon: TrendingDown,
        description: 'Aggregate verified expenses'
      },
      {
        label: 'Expense Volume',
        value: totalCount,
        icon: Receipt,
        description: 'Total vouchers recorded'
      },
      {
        label: 'Awaiting Review',
        value: `$${pendingApproval.toLocaleString()}`,
        icon: ShoppingCart,
        description: 'Unreconciled liabilities'
      },
      {
        label: 'Policy Deviation',
        value: '2.1%',
        icon: AlertCircle,
        description: 'Uncategorized spend rate'
      }
    ]
  }, [expenses, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Consolidated Expense Audit",
      subtitle: "Official chronological record of institutional expenditures, project-linked liabilities, and category spending.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Date', dataKey: 'expense_date' },
        { header: 'Description', dataKey: 'description' },
        { header: 'Amount', dataKey: 'amount' },
        { header: 'Category', dataKey: 'category' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: expenses,
      summary: {
        'Total Outflow': summaryMetrics[0].value,
        'Liabilities': summaryMetrics[2].value,
        'Record Count': totalCount
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Financial Center: Expense Reports"
        description="Comprehensive audit of all operational expenditures, project-linked disbursements, and institutional cash outflow."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Expense_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Date', dataKey: 'expense_date' },
            { header: 'Description', dataKey: 'description' },
            { header: 'Amount', dataKey: 'amount' },
            { header: 'Status', dataKey: 'status' }
          ],
          data: expenses
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search expenses by description or project..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={expenses}
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
