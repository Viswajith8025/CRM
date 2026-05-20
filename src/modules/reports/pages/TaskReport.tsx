
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { CheckSquare, Zap, AlertCircle, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

import { useNavigate } from "react-router-dom"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function TaskReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed task audit for "${item.title}"`)
        ReportExportService.exportSingleRecord(
          `Task Audit - ${item.title}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Opening task board for "${item.title}"`)
        navigate(`/tasks?search=${encodeURIComponent(item.title || '')}`)
        break
      case 'download':
        toast.success(`Exporting row data for ${item.title}`)
        ReportExportService.exportToCSV({
          title: "Single_Task_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Operational tasks cannot be deleted from this view for audit safety.`)
        break
    }
  }
  
  const { 
    data: tasks, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch, 
    setSort 
  } = useReport<any>({
    tableName: 'tasks',
    select: '*, assignee:profiles!assigned_to(full_name), project:projects(name)',
    pageSize: 20,
    searchFields: ['title', 'description', 'status', 'priority']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Todo', value: 'todo' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Done', value: 'done' },
        { label: 'Backlog', value: 'backlog' },
      ]
    },
    {
      label: 'Priority',
      value: 'priority',
      type: 'select',
      options: [
        { label: 'Urgent', value: 'urgent' },
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
        { label: 'Low', value: 'low' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Task / Project', 
      accessorKey: 'title',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.title}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-tight">
            {item.project?.name || 'Unassigned Project'}
          </span>
        </div>
      ),
      sortable: true
    },
    { 
      header: 'Assignee', 
      accessorKey: 'assignee',
      cell: (item) => (
        <div className="text-[11px] font-bold">
          {item.assignee?.full_name || 'Unassigned'}
        </div>
      )
    },
    { 
      header: 'Due Date', 
      accessorKey: 'due_date',
      cell: (item) => (
        <div className={cn(
          "text-[11px] font-medium",
          item.due_date && new Date(item.due_date) < new Date() && item.status !== 'done' ? "text-rose-500 font-black" : ""
        )}>
          {item.due_date ? format(new Date(item.due_date), 'MMM d, yyyy') : 'No Deadline'}
        </div>
      )
    },
    { 
      header: 'Priority', 
      accessorKey: 'priority',
      cell: (item) => (
        <Badge 
          variant={item.priority === 'urgent' ? 'destructive' : item.priority === 'high' ? 'default' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.priority}
        </Badge>
      )
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'done' ? 'default' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status?.replace('_', ' ')}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const doneCount = tasks.filter(t => t.status === 'done').length
    const overdueCount = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done').length
    const completionRate = totalCount > 0 ? (doneCount / totalCount) * 100 : 0

    return [
      {
        label: 'Total Tasks',
        value: totalCount,
        icon: CheckSquare,
        description: 'Aggregate workload volume'
      },
      {
        label: 'Velocity Rate',
        value: `${Math.round(completionRate)}%`,
        icon: Zap,
        description: 'Throughput efficiency'
      },
      {
        label: 'Overdue Slippage',
        value: overdueCount,
        icon: AlertCircle,
        description: 'Timeline deviations'
      },
      {
        label: 'Active Backlog',
        value: tasks.filter(t => t.status === 'todo').length,
        icon: Clock,
        description: 'Queue depth'
      }
    ]
  }, [tasks, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Task Performance Audit",
      subtitle: "Full diagnostic of workforce output, task cycle times, and delivery compliance.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Task', dataKey: 'title' },
        { header: 'Project', dataKey: 'project' },
        { header: 'Assignee', dataKey: 'assignee' },
        { header: 'Due Date', dataKey: 'due_date' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: tasks,
      summary: {
        'Total Workload': totalCount,
        'Completion %': summaryMetrics[1].value,
        'Overdue Count': summaryMetrics[2].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Operations: Task Performance"
        description="Institutional audit of task lifecycles, delivery speed, and individual accountability metrics."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Task_Performance_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Task', dataKey: 'title' },
            { header: 'Assignee', dataKey: 'assignee' },
            { header: 'Due Date', dataKey: 'due_date' },
            { header: 'Status', dataKey: 'status' }
          ],
          data: tasks
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search tasks by title, project, or assignee..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={tasks}
          isLoading={isLoading}
          totalCount={totalCount}
          page={page}
          limit={20}
          onPageChange={setPage}
          onSort={(key, order) => setSort({ key, order })}
          onRowAction={handleRowAction}
        />
      </div>
    </div>
  )
}

import { cn } from "@/lib/utils"
