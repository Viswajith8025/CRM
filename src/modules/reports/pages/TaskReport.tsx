import { useState, useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { CheckSquare, Clock, AlertTriangle, CheckCircle2, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export default function TaskReport() {
  const { 
    data: tasks, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    setFilters, 
    setSearch, 
    setSort,
    filters 
  } = useReport<any>({
    tableName: 'tasks',
    select: '*, project:projects(name), assignee:profiles!assigned_to(full_name)',
    pageSize: 15
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'To Do', value: 'todo' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'In Review', value: 'review' },
        { label: 'Completed', value: 'done' },
      ]
    },
    {
      label: 'Priority',
      value: 'priority',
      type: 'select',
      options: [
        { label: 'High', value: 'high' },
        { label: 'Medium', value: 'medium' },
        { label: 'Low', value: 'low' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Task Title', 
      accessorKey: 'title',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.title}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{item.project?.name || 'No Project'}</span>
        </div>
      ),
      sortable: true
    },
    { 
      header: 'Assignee', 
      accessorKey: 'assignee',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{item.assignee?.full_name || 'Unassigned'}</span>
        </div>
      )
    },
    { 
      header: 'Due Date', 
      accessorKey: 'due_date',
      cell: (item) => item.due_date ? format(new Date(item.due_date), 'MMM dd, yyyy') : 'No Due Date',
      sortable: true
    },
    { 
      header: 'Priority', 
      accessorKey: 'priority',
      cell: (item) => (
        <Badge variant="outline" className={cn(
          "text-[9px] uppercase font-black",
          item.priority === 'high' ? "border-rose-500 text-rose-500" : "border-amber-500 text-amber-500"
        )}>
          {item.priority}
        </Badge>
      ),
      sortable: true
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge variant={item.status === 'done' ? 'default' : 'secondary'} className="text-[10px] uppercase font-black">
          {item.status.replace('_', ' ')}
        </Badge>
      ),
      sortable: true
    }
  ]

  const summaryMetrics = useMemo(() => {
    return [
      {
        label: 'Total Tasks',
        value: totalCount,
        icon: CheckSquare,
        description: 'Aggregate workload'
      },
      {
        label: 'Completed',
        value: tasks.filter((t: any) => t.status === 'done').length,
        icon: CheckCircle2,
        description: 'Successfully closed'
      },
      {
        label: 'In Progress',
        value: tasks.filter((t: any) => t.status === 'in_progress').length,
        icon: Clock,
        description: 'Currently active'
      },
      {
        label: 'Overdue',
        value: '5', // Placeholder
        icon: AlertTriangle,
        description: 'Past deadline'
      }
    ]
  }, [tasks, totalCount])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Task Performance Report"
        description="Operational audit of task progression, resource allocation, and project lifecycle milestones."
        onPrint={() => window.print()}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search by task title or project..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={tasks}
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

function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ')
}
