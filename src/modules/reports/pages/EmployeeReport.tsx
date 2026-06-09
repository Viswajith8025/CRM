
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { Users, UserCheck, Shield, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

import { useNavigate } from "react-router-dom"

export default function EmployeeReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  
  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed audit for ${item.full_name}`)
        ReportExportService.exportSingleRecord(
          item.full_name || 'Employee Audit',
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Redirecting to Team management for ${item.full_name}`)
        navigate(`/teams?search=${encodeURIComponent(item.full_name || '')}`)
        break
      case 'download':
        toast.success(`Exporting row data for ${item.full_name}`)
        ReportExportService.exportToCSV({
          title: "Employee_Record_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Institutional data cannot be deleted from the reporting view.`)
        break
    }
  }
  
  const { 
    data: employees, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch, 
    refresh 
  } = useReport<any>({
    tableName: 'profiles',
    pageSize: 20,
    searchFields: ['full_name', 'email']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Role',
      value: 'role',
      type: 'select',
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Manager', value: 'manager' },
        { label: 'Employee', value: 'employee' },
        { label: 'Contractor', value: 'contractor' },
      ]
    },
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Pending', value: 'pending' },
        { label: 'Suspended', value: 'suspended' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Employee', 
      accessorKey: 'full_name',
      cell: (item) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 rounded-lg border border-border/50">
            <AvatarImage src={item.avatar_url} />
            <AvatarFallback className="text-[10px] font-black uppercase">{item.full_name?.substring(0, 2)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-bold">{item.full_name}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-medium">{item.email}</span>
          </div>
        </div>
      )
    },
    { 
      header: 'Position / Role', 
      accessorKey: 'role',
      cell: (item) => (
        <Badge variant="outline" className="text-[10px] uppercase font-black border-primary/20 bg-primary/5 text-primary">
          {item.role}
        </Badge>
      )
    },
    { 
      header: 'Hourly Rate', 
      accessorKey: 'hourly_rate',
      cell: (item) => <span className="font-black text-emerald-600">${item.hourly_rate || '0.00'}/hr</span>
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="text-[10px] uppercase font-black">
          {item.status}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => [
    {
      label: 'Total Workforce',
      value: totalCount,
      icon: Users,
      description: 'All registered profiles'
    },
    {
      label: 'Active Operators',
      value: employees.filter((e: any) => e.status === 'active').length,
      icon: UserCheck,
      description: 'Verified identities'
    },
    {
      label: 'Admin Strength',
      value: employees.filter((e: any) => e.role === 'admin').length,
      icon: Shield,
      description: 'System governance'
    },
    {
      label: 'Average Rate',
      value: `$${(employees.reduce((sum: number, e: any) => sum + (e.hourly_rate || 0), 0) / (employees.length || 1)).toFixed(2)}`,
      icon: Clock,
      description: 'Resource valuation'
    }
  ], [employees, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Employee Directory Report",
      subtitle: "Comprehensive workforce audit and resource allocation matrix.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Full Name', dataKey: 'full_name' },
        { header: 'Email', dataKey: 'email' },
        { header: 'Role', dataKey: 'role' },
        { header: 'Rate', dataKey: 'hourly_rate' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: employees,
      summary: {
        'Total Employees': totalCount,
        'Active Profiles': summaryMetrics[1].value,
        'Admin Count': summaryMetrics[2].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Employee Directory"
        description="Chronological audit of all organization members, access roles, and workforce financial metrics."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Employee_Directory",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Full Name', dataKey: 'full_name' },
            { header: 'Email', dataKey: 'email' },
            { header: 'Role', dataKey: 'role' },
            { header: 'Rate', dataKey: 'hourly_rate' },
            { header: 'Status', dataKey: 'status' },
          ],
          data: employees
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search by name, email, or role..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={employees}
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
