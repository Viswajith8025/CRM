
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { Target, TrendingUp, Users, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

export default function LeadReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  
  const handleRowAction = (action: RowAction, item: any) => {
    const leadName = `${item.first_name} ${item.last_name}`
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed audit for lead: ${leadName}`)
        ReportExportService.exportSingleRecord(
          `Lead Audit - ${leadName}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Redirecting to CRM for lead: ${leadName}`)
        navigate(`/crm?search=${encodeURIComponent(leadName)}`)
        break
      case 'download':
        toast.success(`Exporting row data for ${leadName}`)
        ReportExportService.exportToCSV({
          title: "Single_Lead_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Lead records are protected by organization retention policies.`)
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
    searchFields: ['first_name', 'last_name', 'email', 'company']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Lost', value: 'lost' },
        { label: 'Converted', value: 'converted' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Lead / Company', 
      accessorKey: 'first_name',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.first_name} {item.last_name}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-tight">
            {item.company || 'Private Individual'}
          </span>
        </div>
      )
    },
    { 
      header: 'Email', 
      accessorKey: 'email',
      cell: (item) => <span className="text-xs font-medium">{item.email}</span>
    },
    { 
      header: 'Value', 
      accessorKey: 'estimated_value',
      cell: (item) => <span className="font-black text-emerald-600">₹{Number(item.estimated_value || 0).toLocaleString()}</span>
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge variant={item.status === 'converted' ? 'default' : 'secondary'} className="text-[10px] uppercase font-black">
          {item.status}
        </Badge>
      )
    },
    { 
      header: 'Created', 
      accessorKey: 'created_at',
      cell: (item) => (
        <span className="text-[11px] font-medium">
          {item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy') : 'N/A'}
        </span>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const totalValue = leads.reduce((sum: number, l: any) => sum + Number(l.estimated_value || 0), 0)
    const conversionRate = totalCount > 0 ? (leads.filter((l: any) => l.status === 'converted').length / leads.length) * 100 : 0

    return [
      {
        label: 'Lead Velocity',
        value: totalCount,
        icon: Target,
        description: 'New prospects captured'
      },
      {
        label: 'Pipeline Value',
        value: `₹${totalValue.toLocaleString()}`,
        icon: TrendingUp,
        description: 'Projected revenue'
      },
      {
        label: 'Conversion Rate',
        value: `${Math.round(conversionRate)}%`,
        icon: Users,
        description: 'Lead to client success'
      },
      {
        label: 'Average Age',
        value: '12 Days',
        icon: Clock,
        description: 'Response latency'
      }
    ]
  }, [leads, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Sales Pipeline Audit",
      subtitle: "Comprehensive review of lead generation, pipeline value, and conversion performance.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Name', dataKey: 'first_name' },
        { header: 'Company', dataKey: 'company' },
        { header: 'Value', dataKey: 'estimated_value' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Created', dataKey: 'created_at' },
      ],
      data: leads,
      summary: {
        'Total Leads': totalCount,
        'Pipeline Value': summaryMetrics[1].value,
        'Conversion Rate': summaryMetrics[2].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Sales Pipeline: Leads"
        description="Chronological audit of prospecting efforts, estimated pipeline value, and conversion status across territories."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Lead_Performance_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Name', dataKey: 'first_name' },
            { header: 'Email', dataKey: 'email' },
            { header: 'Status', dataKey: 'status' },
            { header: 'Value', dataKey: 'estimated_value' }
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
        searchPlaceholder="Search leads by name, email, or company..."
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
