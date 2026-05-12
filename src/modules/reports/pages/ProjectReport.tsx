import { useState, useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { Briefcase, Activity, Calendar, DollarSign, Target } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export default function ProjectReport() {
  const { 
    data: projects, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    setFilters, 
    setSearch, 
    setSort,
    filters 
  } = useReport<any>({
    tableName: 'projects',
    select: '*, client:profiles(full_name)',
    pageSize: 15
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
          <span className="text-[10px] text-muted-foreground uppercase">{item.client?.full_name || 'Internal'}</span>
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
      header: 'Budget', 
      accessorKey: 'budget',
      cell: (item) => <span className="font-black text-emerald-600">${item.budget?.toLocaleString() || '0'}</span>,
      sortable: true
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge variant={item.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] uppercase font-black">
          {item.status?.replace('_', ' ')}
        </Badge>
      ),
      sortable: true
    }
  ]

  const summaryMetrics = useMemo(() => {
    return [
      {
        label: 'Total Projects',
        value: totalCount,
        icon: Briefcase,
        description: 'Portfolio engagement'
      },
      {
        label: 'Active Delivery',
        value: projects.filter((p: any) => p.status === 'in_progress').length,
        icon: Activity,
        description: 'Currently in production'
      },
      {
        label: 'Total Budget',
        value: `$${projects.reduce((sum: number, p: any) => sum + Number(p.budget || 0), 0).toLocaleString()}`,
        icon: DollarSign,
        description: 'Managed asset value'
      },
      {
        label: 'Milestones Met',
        value: '84%',
        icon: Target,
        description: 'Efficiency rating'
      }
    ]
  }, [projects, totalCount])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Project Lifecycle Report"
        description="Comprehensive audit of project timelines, budget utilization, and delivery status across the portfolio."
        onPrint={() => window.print()}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search by project or client name..."
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
        />
      </div>
    </div>
  )
}
