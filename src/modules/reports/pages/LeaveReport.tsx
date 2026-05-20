
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { Calendar, CheckCircle, Clock, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function LeaveReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRowAction = (action: RowAction, item: any) => {
    const employeeName = item.profile?.full_name || 'System User'
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed audit for ${employeeName}`)
        ReportExportService.exportSingleRecord(
          `${employeeName} - Leave Audit`,
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
          title: "Leave_Request_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Leave records are archived for legal compliance.`)
        break
    }
  }
  
  const { 
    data: requests, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch 
  } = useReport<any>({
    tableName: 'leave_requests',
    select: '*, profile:profiles!user_id(full_name)',
    pageSize: 20,
    searchFields: ['reason', 'status', 'leave_type']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ]
    },
    {
      label: 'Type',
      value: 'leave_type',
      type: 'select',
      options: [
        { label: 'Vacation', value: 'vacation' },
        { label: 'Sick Leave', value: 'sick' },
        { label: 'Personal', value: 'personal' },
        { label: 'Maternity/Paternity', value: 'parental' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Employee', 
      accessorKey: 'profile',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.profile?.full_name || 'System User'}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">{item.leave_type}</span>
        </div>
      )
    },
    { 
      header: 'Start Date', 
      accessorKey: 'start_date',
      cell: (item) => (
        <div className="text-[11px] font-bold">
          {item.start_date ? format(new Date(item.start_date), 'MMM d, yyyy') : '---'}
        </div>
      )
    },
    { 
      header: 'End Date', 
      accessorKey: 'end_date',
      cell: (item) => (
        <div className="text-[11px] font-bold">
          {item.end_date ? format(new Date(item.end_date), 'MMM d, yyyy') : '---'}
        </div>
      )
    },
    { 
      header: 'Reason', 
      accessorKey: 'reason',
      cell: (item) => <span className="text-xs text-muted-foreground italic truncate max-w-[200px] block">{item.reason || 'No reason provided'}</span>
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'approved' ? 'default' : item.status === 'rejected' ? 'destructive' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const approvedCount = requests.filter(r => r.status === 'approved').length
    const pendingCount = requests.filter(r => r.status === 'pending').length
    
    return [
      {
        label: 'Total Requests',
        value: totalCount,
        icon: Calendar,
        description: 'Aggregate leave intake'
      },
      {
        label: 'Approved Leaves',
        value: approvedCount,
        icon: CheckCircle,
        description: 'Authorized absences'
      },
      {
        label: 'Pending Approval',
        value: pendingCount,
        icon: Clock,
        description: 'Awaiting HR verification'
      },
      {
        label: 'Rejection Rate',
        value: `${totalCount > 0 ? Math.round((requests.filter(r => r.status === 'rejected').length / totalCount) * 100) : 0}%`,
        icon: AlertTriangle,
        description: 'Policy compliance'
      }
    ]
  }, [requests, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Leave Management Audit",
      subtitle: "Official breakdown of employee leave requests, approval history, and absence categories.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Employee', dataKey: 'profile' },
        { header: 'Type', dataKey: 'leave_type' },
        { header: 'Start Date', dataKey: 'start_date' },
        { header: 'End Date', dataKey: 'end_date' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: requests,
      summary: {
        'Total Requests': totalCount,
        'Approved Count': summaryMetrics[1].value,
        'Pending Review': summaryMetrics[2].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="HR: Leave Management"
        description="Comprehensive audit of institutional leave requests, absence trends, and workforce capacity planning."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Leave_Management_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Employee', dataKey: 'profile' },
            { header: 'Type', dataKey: 'leave_type' },
            { header: 'Start Date', dataKey: 'start_date' },
            { header: 'Status', dataKey: 'status' }
          ],
          data: requests
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search leave requests by employee name..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={requests}
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
