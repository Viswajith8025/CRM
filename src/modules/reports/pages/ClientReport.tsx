import { useState, useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { Users, Building2, Globe, Mail, Phone } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export default function ClientReport() {
  const { 
    data: clients, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    setFilters, 
    setSearch, 
    setSort,
    filters 
  } = useReport<any>({
    tableName: 'profiles',
    baseQuery: null, // useReport handles basic organization filtering
    select: '*',
    defaultFilters: { role: 'client' },
    pageSize: 15
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Pending', value: 'pending' },
        { label: 'Inactive', value: 'inactive' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Client Name', 
      accessorKey: 'full_name',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.full_name || 'N/A'}</span>
          <span className="text-[10px] text-muted-foreground uppercase">{item.company_name || 'Individual'}</span>
        </div>
      ),
      sortable: true
    },
    { 
      header: 'Contact Info', 
      accessorKey: 'email',
      cell: (item) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-xs">
            <Mail className="h-3 w-3 text-muted-foreground" />
            {item.email}
          </div>
          {item.phone && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Phone className="h-2.5 w-2.5" />
              {item.phone}
            </div>
          )}
        </div>
      )
    },
    { 
      header: 'Joined Date', 
      accessorKey: 'created_at',
      cell: (item) => format(new Date(item.created_at), 'MMM dd, yyyy'),
      sortable: true
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="text-[10px] uppercase font-black">
          {item.status}
        </Badge>
      ),
      sortable: true
    }
  ]

  const summaryMetrics = useMemo(() => {
    return [
      {
        label: 'Total Clients',
        value: totalCount,
        icon: Users,
        description: 'Institutional portfolio'
      },
      {
        label: 'Active Partners',
        value: clients.filter((c: any) => c.status === 'active').length,
        icon: Building2,
        description: 'Currently engaged'
      },
      {
        label: 'New This Month',
        value: '4', // Placeholder
        icon: Globe,
        description: 'Portfolio growth'
      }
    ]
  }, [clients, totalCount])

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Client Portfolio Report"
        description="Strategic oversight of institutional clients, acquisition history, and account standing."
        onPrint={() => window.print()}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search by client name, email or company..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={clients}
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
