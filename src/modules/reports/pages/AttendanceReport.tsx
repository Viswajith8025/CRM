import { useState, useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { Users, Clock, CheckCircle2, XCircle, Calendar } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export default function AttendanceReport() {
  const { 
    data: attendance, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    setFilters, 
    setSearch, 
    setSort,
    filters 
  } = useReport<any>({
    tableName: 'attendance',
    select: '*, profile:profiles(full_name, email, avatar_url)',
    pageSize: 15
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Present', value: 'present' },
        { label: 'Absent', value: 'absent' },
        { label: 'Late', value: 'late' },
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
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={item.profile?.avatar_url} />
            <AvatarFallback>{item.profile?.full_name?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="font-bold">{item.profile?.full_name || 'Unknown'}</span>
            <span className="text-[10px] text-muted-foreground">{item.profile?.email}</span>
          </div>
        </div>
      )
    },
    { 
      header: 'Date', 
      accessorKey: 'date',
      cell: (item) => format(new Date(item.date), 'MMM dd, yyyy'),
      sortable: true
    },
    { 
      header: 'Clock In', 
      accessorKey: 'clock_in',
      cell: (item) => item.clock_in ? format(new Date(item.clock_in), 'hh:mm a') : '--:--',
    },
    { 
      header: 'Clock Out', 
      accessorKey: 'clock_out',
      cell: (item) => item.clock_out ? format(new Date(item.clock_out), 'hh:mm a') : '--:--',
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge variant={item.status === 'present' ? 'default' : 'destructive'} className="text-[10px] uppercase font-black">
          {item.status}
        </Badge>
      ),
      sortable: true
    }
  ]

  const summaryMetrics = useMemo(() => {
    return [
      {
        label: 'Total Records',
        value: totalCount,
        icon: Users,
        description: 'Records in period'
      },
      {
        label: 'Present Today',
        value: attendance.filter((a: any) => a.status === 'present').length,
        icon: CheckCircle2,
        description: 'Employee turnout'
      },
      {
        label: 'Late Arrivals',
        value: attendance.filter((a: any) => a.status === 'late').length,
        icon: Clock,
        description: 'Clock-in past threshold'
      },
      {
        label: 'Leaves Taken',
        value: '12', // Placeholder
        icon: Calendar,
        description: 'Approved time off'
      }
    ]
  }, [attendance, totalCount])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Attendance & Punctuality Report"
        description="Detailed log of employee clock-in/out times, presence status, and monthly turnout analytics."
        onPrint={() => window.print()}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search by employee name..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={attendance}
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
