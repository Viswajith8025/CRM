
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { Target, TrendingUp, UserMinus, CheckCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function CRMReport() {
  const { profile } = useAuthStore()
  
  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
        toast.info(`Viewing lead: ${item.first_name} ${item.last_name}`)
        break
      case 'edit':
        toast.info(`Lead conversions and edits are managed in the Sales module.`)
        break
      case 'download':
        toast.success(`Exporting intake voucher for ${item.first_name}`)
        break
      case 'delete':
        toast.error(`Lead records are immutable within the audit view.`)
        break
    }
  }
  
  const { 
    data: leads, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch 
  } = useReport<any>({
    tableName: 'leads',
    pageSize: 20,
    searchFields: ['first_name', 'last_name', 'company', 'email']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Stage',
      value: 'status',
      type: 'select',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Proposal Sent', value: 'proposal_sent' },
        { label: 'Awaiting Payment', value: 'awaiting_payment' },
        { label: 'Won (Converted)', value: 'active_client' },
        { label: 'Lost', value: 'lost' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Lead Name', 
      accessorKey: 'first_name',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.first_name} {item.last_name}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">{item.company || 'Private Individual'}</span>
        </div>
      )
    },
    { 
      header: 'Contact Info', 
      accessorKey: 'email',
      cell: (item) => (
        <div className="flex flex-col text-[11px]">
          <span>{item.email}</span>
          <span className="text-muted-foreground">{item.phone}</span>
        </div>
      )
    },
    { 
      header: 'Created At', 
      accessorKey: 'created_at',
      cell: (item) => (
        <div className="text-[11px] font-medium">
          {item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy') : 'N/A'}
        </div>
      )
    },
    { 
      header: 'Stage', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'active_client' ? 'default' : item.status === 'lost' ? 'destructive' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status?.replace('_', ' ')}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const wonCount = leads.filter(l => l.status === 'active_client').length
    const lostCount = leads.filter(l => l.status === 'lost').length
    const winRate = totalCount > 0 ? (wonCount / totalCount) * 100 : 0

    return [
      {
        label: 'Total Leads',
        value: totalCount,
        icon: Target,
        description: 'Aggregate intake volume'
      },
      {
        label: 'Conversion Rate',
        value: `${Math.round(winRate)}%`,
        icon: TrendingUp,
        description: 'Intake-to-Client efficiency'
      },
      {
        label: 'Lost Opportunities',
        value: lostCount,
        icon: UserMinus,
        description: 'Non-converted pipeline'
      },
      {
        label: 'Successful Closures',
        value: wonCount,
        icon: CheckCircle,
        description: 'New revenue channels'
      }
    ]
  }, [leads, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Sales Pipeline Audit",
      subtitle: "Full breakdown of lead acquisition stages, conversion metrics, and pipeline health.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Lead Name', dataKey: 'first_name' },
        { header: 'Company', dataKey: 'company' },
        { header: 'Email', dataKey: 'email' },
        { header: 'Stage', dataKey: 'status' },
        { header: 'Created', dataKey: 'created_at' },
      ],
      data: leads,
      summary: {
        'Total Intake': totalCount,
        'Win Rate': summaryMetrics[1].value,
        'Lost Leads': summaryMetrics[2].value,
        'Active Clients': summaryMetrics[3].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="CRM: Sales Pipeline"
        description="Chronological audit of lead conversion lifecycles, pipeline stage metrics, and acquisition efficiency."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Sales_Pipeline_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Name', dataKey: 'first_name' },
            { header: 'Company', dataKey: 'company' },
            { header: 'Email', dataKey: 'email' },
            { header: 'Status', dataKey: 'status' }
          ],
          data: leads
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search leads by name, company, or email..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={leads}
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
