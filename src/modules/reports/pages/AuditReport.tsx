import { useState, useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ShieldAlert, Activity, User, History, Terminal } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format, formatDistanceToNow } from "date-fns"

export default function AuditReport() {
  const { 
    data: activities, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    setFilters, 
    setSearch, 
    setSort,
    filters 
  } = useReport<any>({
    tableName: 'activities',
    select: '*, user:profiles(full_name, email)',
    pageSize: 20
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Action',
      value: 'action',
      type: 'select',
      options: [
        { label: 'Created', value: 'created' },
        { label: 'Updated', value: 'updated' },
        { label: 'Deleted', value: 'deleted' },
      ]
    },
    {
      label: 'Target Type',
      value: 'target_type',
      type: 'select',
      options: [
        { label: 'Task', value: 'task' },
        { label: 'Project', value: 'project' },
        { label: 'Invoice', value: 'invoice' },
        { label: 'Client', value: 'client' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Timestamp', 
      accessorKey: 'created_at',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{format(new Date(item.created_at), 'MMM dd, HH:mm:ss')}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
        </div>
      ),
      sortable: true
    },
    { 
      header: 'User', 
      accessorKey: 'user',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="font-bold">{item.user?.full_name || 'System'}</span>
            <span className="text-[10px] text-muted-foreground">{item.user?.email || 'automated@system'}</span>
          </div>
        </div>
      )
    },
    { 
      header: 'Action', 
      accessorKey: 'action',
      cell: (item) => (
        <Badge variant="outline" className="text-[10px] uppercase font-black tracking-widest border-primary/30 text-primary bg-primary/5">
          {item.action}
        </Badge>
      ),
      sortable: true
    },
    { 
      header: 'Target', 
      accessorKey: 'target_name',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[9px] uppercase font-black">{item.target_type}</Badge>
          <span className="font-medium truncate max-w-[200px]">{item.target_name}</span>
        </div>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    return [
      {
        label: 'Total Logs',
        value: totalCount.toLocaleString(),
        icon: History,
        description: 'Audit trail depth'
      },
      {
        label: 'Critical Actions',
        value: activities.filter((a: any) => a.action === 'deleted').length,
        icon: ShieldAlert,
        description: 'Deletions & security events'
      },
      {
        label: 'Active Users',
        value: new Set(activities.map((a: any) => a.user_id)).size,
        icon: Activity,
        description: 'Users in current log'
      },
      {
        label: 'System Uptime',
        value: '99.9%',
        icon: Terminal,
        description: 'Infrastructure health'
      }
    ]
  }, [activities, totalCount])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="System Audit & Activity Log"
        description="Chronological record of all system modifications, administrative actions, and data mutations for compliance and security oversight."
        onPrint={() => window.print()}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search by user, action or target name..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={activities}
          isLoading={isLoading}
          totalCount={totalCount}
          page={page}
          limit={20}
          onPageChange={setPage}
          onSort={(key, order) => setSort({ key, order })}
        />
      </div>
    </div>
  )
}
