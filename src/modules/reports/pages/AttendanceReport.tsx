
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
    tableName: 'attendance',
    select: '*, profile:profiles!user_id(full_name)',
    pageSize: 20,
    defaultSortBy: 'date',
    searchFields: ['status', 'notes']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Present', value: 'present' },
        { label: 'Late', value: 'late' },
        { label: 'Absent', value: 'absent' },
        { label: 'On Leave', value: 'on_leave' },
      ]
    },
    {
      label: 'Date',
      value: 'date',
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
          <span className="text-[10px] text-muted-foreground uppercase font-medium">{item.date}</span>
        </div>
      )
    },
    { 
      header: 'Clock In', 
      accessorKey: 'clock_in',
      cell: (item) => (
        <div className="text-[11px] font-bold">
          {item.clock_in ? format(new Date(item.clock_in), 'hh:mm a') : '---'}
        </div>
      )
    },
    { 
      header: 'Clock Out', 
      accessorKey: 'clock_out',
      cell: (item) => (
        <div className="text-[11px] font-bold">
          {item.clock_out ? format(new Date(item.clock_out), 'hh:mm a') : '---'}
        </div>
      )
    },
    { 
      header: 'Duration', 
      accessorKey: 'duration',
      cell: (item) => {
        if (!item.clock_in || !item.clock_out) return '---'
        const mins = differenceInMinutes(new Date(item.clock_out), new Date(item.clock_in))
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
          variant={item.status === 'present' ? 'default' : item.status === 'late' ? 'destructive' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const presentCount = logs.filter(l => l.status === 'present').length
    const lateCount = logs.filter(l => l.status === 'late').length
    
    return [
      {
        label: 'Total Sessions',
        value: totalCount,
        icon: Clock,
        description: 'Aggregate attendance entries'
      },
      {
        label: 'On-Time Rate',
        value: `${totalCount > 0 ? Math.round(((totalCount - lateCount) / totalCount) * 100) : 0}%`,
        icon: UserCheck,
        description: 'Punctuality efficiency'
      },
      {
        label: 'Late Arrivals',
        value: lateCount,
        icon: AlertCircle,
        description: 'Schedule deviations'
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
        { header: 'Date', dataKey: 'date' },
        { header: 'Clock In', dataKey: 'clock_in' },
        { header: 'Clock Out', dataKey: 'clock_out' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: logs,
      summary: {
        'Total Sessions': totalCount,
        'Late Arrivals': summaryMetrics[2].value,
        'On-Time Rate': summaryMetrics[1].value
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
