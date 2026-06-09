
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { Clock, UserCheck, AlertCircle, Coffee } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format, differenceInMinutes } from "date-fns"
import { useNavigate } from "react-router-dom"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function AttendanceReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRowAction = (action: RowAction, item: any) => {
    const employeeName = item.profile?.full_name || 'System User'
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed audit for ${employeeName}`)
        ReportExportService.exportSingleRecord(
          `${employeeName} - Attendance Audit`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Redirecting to HR management for ${employeeName}`)
        navigate(`/teams?search=${encodeURIComponent(employeeName)}`)
        break
      case 'download':
        toast.success(`Exporting row data...`)
        ReportExportService.exportToCSV({
          title: "Attendance_Log_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Attendance logs are locked for integrity.`)
        break
    }
  }
  
  const { 
    data: logs, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch 
  } = useReport<any>({
    tableName: 'work_sessions',
    select: '*, profile:profiles(full_name)',
    pageSize: 20,
    defaultSortBy: 'start_time',
    searchFields: []
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Completed', value: 'completed' },
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' }
      ]
    },
    {
      label: 'Date',
      value: 'start_time',
      type: 'date'
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Employee', 
      accessorKey: 'profile',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.profile?.full_name || 'System User'}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">{item.start_time ? format(new Date(item.start_time), 'MMM d, yyyy') : '---'}</span>
        </div>
      )
    },
    { 
      header: 'Clock In', 
      accessorKey: 'start_time',
      cell: (item) => (
        <div className="text-[11px] font-bold">
          {item.start_time ? format(new Date(item.start_time), 'hh:mm a') : '---'}
        </div>
      )
    },
    { 
      header: 'Clock Out', 
      accessorKey: 'end_time',
      cell: (item) => (
        <div className="text-[11px] font-bold">
          {item.end_time ? format(new Date(item.end_time), 'hh:mm a') : '---'}
        </div>
      )
    },
    { 
      header: 'Duration', 
      accessorKey: 'duration',
      cell: (item) => {
        if (!item.start_time || !item.end_time) return '---'
        const mins = differenceInMinutes(new Date(item.end_time), new Date(item.start_time))
        const hours = Math.floor(mins / 60)
        const remMins = mins % 60
        return <span className="font-black text-xs">{hours}h {remMins}m</span>
      }
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'completed' ? 'default' : item.status === 'active' ? 'secondary' : 'destructive'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const completedCount = logs.filter(l => l.status === 'completed').length
    const activeCount = logs.filter(l => l.status === 'active').length
    
    return [
      {
        label: 'Total Sessions',
        value: totalCount,
        icon: Clock,
        description: 'Aggregate attendance entries'
      },
      {
        label: 'Completed Shifts',
        value: completedCount,
        icon: UserCheck,
        description: 'Successfully checked out'
      },
      {
        label: 'Active Operators',
        value: activeCount,
        icon: AlertCircle,
        description: 'Currently clocked in'
      },
      {
        label: 'Break Compliance',
        value: '94%',
        icon: Coffee,
        description: 'Operational health'
      }
    ]
  }, [logs, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Workforce Attendance Audit",
      subtitle: "Official chronological log of employee clock-in/out events and shift compliance.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Employee', dataKey: 'profile' },
        { header: 'Clock In', dataKey: 'start_time' },
        { header: 'Clock Out', dataKey: 'end_time' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: logs,
      summary: {
        'Total Sessions': totalCount,
        'Active Operators': summaryMetrics[2].value,
        'Completed Shifts': summaryMetrics[1].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="HR: Attendance Logs"
        description="Comprehensive audit of institutional attendance sessions, punctuality metrics, and labor duration tracking."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Attendance_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Employee', dataKey: 'profile' },
            { header: 'Date', dataKey: 'date' },
            { header: 'Status', dataKey: 'status' }
          ],
          data: logs
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search attendance by employee name..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={logs}
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
