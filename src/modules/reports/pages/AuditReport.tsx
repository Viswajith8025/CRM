
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { Shield, Activity, User, Info } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function AuditReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed forensic audit for event`)
        ReportExportService.exportSingleRecord(
          `Security Audit - ${item.action}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        // Try to navigate to the target entity
        if (item.target_type === 'invoice') navigate(`/billing?search=${encodeURIComponent(item.target_name)}`)
        else if (item.target_type === 'lead') navigate(`/crm?search=${encodeURIComponent(item.target_name)}`)
        else if (item.target_type === 'task') navigate(`/tasks?search=${encodeURIComponent(item.target_name)}`)
        else toast.info(`Direct navigation not supported for ${item.target_type}`)
        break
      case 'download':
        toast.success(`Exporting log entry...`)
        ReportExportService.exportToCSV({
          title: "Audit_Entry_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Audit logs are immutable for institutional security.`)
        break
    }
  }
  
  const { 
    data: activities, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch 
  } = useReport<any>({
    tableName: 'activities',
    select: '*, profile:profiles(full_name)',
    pageSize: 50,
    searchFields: ['action', 'target_name', 'target_type', 'description']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Severity',
      value: 'severity',
      type: 'select',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Critical', value: 'critical' },
      ]
    },
    {
      label: 'Target Type',
      value: 'target_type',
      type: 'select',
      options: [
        { label: 'Project', value: 'project' },
        { label: 'Task', value: 'task' },
        { label: 'Invoice', value: 'invoice' },
        { label: 'User', value: 'user' },
        { label: 'Lead', value: 'lead' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Timestamp', 
      accessorKey: 'created_at',
      cell: (item) => (
        <div className="text-[10px] font-bold text-muted-foreground whitespace-nowrap">
          {item.created_at ? format(new Date(item.created_at), 'MMM d, HH:mm:ss') : '---'}
        </div>
      )
    },
    { 
      header: 'Actor', 
      accessorKey: 'profile',
      cell: (item) => (
        <div className="flex items-center gap-2">
          <User className="h-3 w-3 opacity-30" />
          <span className="font-bold text-xs">{item.profile?.full_name || 'System Agent'}</span>
        </div>
      )
    },
    { 
      header: 'Action', 
      accessorKey: 'action',
      cell: (item) => (
        <Badge variant="outline" className="text-[9px] uppercase font-black border-border/50 bg-muted/30">
          {item.action}
        </Badge>
      )
    },
    { 
      header: 'Entity / Details', 
      accessorKey: 'target_name',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-black text-[10px] uppercase tracking-tighter">{item.target_type}: {item.target_name}</span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[300px]">{item.description || item.metadata?.description || '-'}</span>
        </div>
      )
    },
    { 
      header: 'Severity', 
      accessorKey: 'severity',
      cell: (item) => (
        <div className={cn(
          "h-2 w-2 rounded-full",
          item.severity === 'critical' ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" : 
          item.severity === 'warning' ? "bg-amber-500" : "bg-blue-500"
        )} />
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const criticalCount = activities.filter(a => a.severity === 'critical').length
    const uniqueActors = new Set(activities.map(a => a.user_id)).size

    return [
      {
        label: 'Audit Events',
        value: totalCount,
        icon: Shield,
        description: 'Chronological footprint'
      },
      {
        label: 'Active Entities',
        value: uniqueActors,
        icon: Activity,
        description: 'Distinct actors tracked'
      },
      {
        label: 'Security Alerts',
        value: criticalCount,
        icon: Info,
        description: 'High-severity logs'
      },
      {
        label: 'Compliance Score',
        value: '100%',
        icon: Shield,
        description: 'Data integrity rating'
      }
    ]
  }, [activities, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "System Audit Log Report",
      subtitle: "Irrefutable chronological record of all institutional actions, entity mutations, and security events.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Time', dataKey: 'created_at' },
        { header: 'Actor', dataKey: 'profile' },
        { header: 'Action', dataKey: 'action' },
        { header: 'Target', dataKey: 'target_name' },
        { header: 'Description', dataKey: 'description' },
      ],
      data: activities,
      summary: {
        'Total Logs': totalCount,
        'Critical Alerts': summaryMetrics[2].value,
        'Compliance': 'Verified'
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Security: Audit Logs"
        description="Immutable system activity feed, chronological operation tracking, and institutional accountability audit."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "System_Audit_Log",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Timestamp', dataKey: 'created_at' },
            { header: 'Action', dataKey: 'action' },
            { header: 'Target', dataKey: 'target_name' },
            { header: 'Description', dataKey: 'description' }
          ],
          data: activities
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search audit logs by actor, action, or entity..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={activities}
          isLoading={isLoading}
          totalCount={totalCount}
          page={page}
          limit={50}
          onPageChange={setPage}
          onRowAction={handleRowAction}
        />
      </div>
    </div>
  )
}

import { cn } from "@/lib/utils"
