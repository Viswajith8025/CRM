
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { Briefcase, Activity, Calendar, DollarSign, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

import { useNavigate } from "react-router-dom"

export default function ProjectReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  
  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating project lifecycle audit for ${item.name}`)
        ReportExportService.exportSingleRecord(
          `Project Audit - ${item.name}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Opening project: ${item.name}`)
        navigate(`/projects/${item.id}`)
        break
      case 'download':
        toast.success(`Exporting row data for ${item.name}`)
        ReportExportService.exportToCSV({
          title: "Single_Project_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Institutional projects are immutable in this audit view for security.`)
        break
    }
  }
  
  const { 
    data: projects, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch, 
    setSort 
  } = useReport<any>({
    tableName: 'projects',
    select: '*, client:clients(name)',
    pageSize: 15,
    searchFields: ['name', 'description', 'status']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Planning', value: 'planning' },
        { label: 'Active', value: 'in_progress' },
        { label: 'On Hold', value: 'on_hold' },
        { label: 'Completed', value: 'completed' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Project Name', 
      accessorKey: 'name',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.name}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-tight">
            {item.client?.name || 'Internal Operations'}
          </span>
        </div>
      ),
      sortable: true
    },
    { 
      header: 'Timeline', 
      accessorKey: 'start_date',
      cell: (item) => (
        <div className="text-[11px] font-medium">
          {item.start_date ? format(new Date(item.start_date), 'MMM d, yy') : 'N/A'} - {item.end_date ? format(new Date(item.end_date), 'MMM d, yy') : 'Cont.'}
        </div>
      )
    },
    { 
      header: 'Budget Allocation', 
      accessorKey: 'budget',
      cell: (item) => <span className="font-black text-emerald-600">₹{Number(item.budget || 0).toLocaleString()}</span>,
      sortable: true
    },
    { 
      header: 'Stage', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'completed' ? 'default' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status?.replace('_', ' ')}
        </Badge>
      ),
      sortable: true
    }
  ]

  const summaryMetrics = useMemo(() => {
    const totalBudget = projects.reduce((sum, p) => sum + Number(p.budget || 0), 0)
    const activeCount = projects.filter(p => p.status === 'in_progress').length
    const completionRate = projects.length > 0 ? (projects.filter(p => p.status === 'completed').length / projects.length) * 100 : 0

    return [
      {
        label: 'Project Portfolio',
        value: totalCount,
        icon: Briefcase,
        description: 'Total active engagements'
      },
      {
        label: 'Active Delivery',
        value: activeCount,
        icon: Activity,
        description: 'Currently in production'
      },
      {
        label: 'Portfolio Value',
        value: `₹${totalBudget.toLocaleString()}`,
        icon: DollarSign,
        description: 'Managed asset total'
      },
      {
        label: 'Delivery Rate',
        value: `${Math.round(completionRate)}%`,
        icon: Target,
        description: 'Portfolio efficiency'
      }
    ]
  }, [projects, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Project Lifecycle Audit",
      subtitle: "Comprehensive review of project timelines, budgets, and delivery stages.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Project', dataKey: 'name' },
        { header: 'Budget', dataKey: 'budget' },
        { header: 'Start Date', dataKey: 'start_date' },
        { header: 'End Date', dataKey: 'end_date' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: projects,
      summary: {
        'Total Projects': totalCount,
        'Portfolio Value': summaryMetrics[2].value,
        'Efficiency': summaryMetrics[3].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Operations: Project Lifecycle"
        description="Chronological audit of project status, timeline deviations, and budget utilization across the enterprise."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Project_Lifecycle_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Project Name', dataKey: 'name' },
            { header: 'Budget', dataKey: 'budget' },
            { header: 'Status', dataKey: 'status' },
            { header: 'Start Date', dataKey: 'start_date' }
          ],
          data: projects
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search projects by name or client..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={projects}
          isLoading={isLoading}
          totalCount={totalCount}
          page={page}
          limit={15}
          onPageChange={setPage}
          onSort={(key, order) => setSort({ key, order })}
          onRowAction={handleRowAction}
        />
      </div>
    </div>
  )
}
