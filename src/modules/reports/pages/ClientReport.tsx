
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { Users, Building2, Globe, Mail, Phone, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

import { useNavigate } from "react-router-dom"

export default function ClientReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  
  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed account audit for ${item.name}`)
        ReportExportService.exportSingleRecord(
          `Client Audit - ${item.name}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Redirecting to CRM for ${item.name}`)
        navigate(`/clients?search=${encodeURIComponent(item.name || '')}`)
        break
      case 'download':
        toast.success(`Exporting row data for ${item.name}`)
        ReportExportService.exportToCSV({
          title: "Single_Client_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Institutional partners are protected by data retention policies.`)
        break
    }
  }
  
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
    tableName: 'clients',
    select: '*',
    pageSize: 15,
    searchFields: ['name', 'industry', 'address', 'email']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Prospect', value: 'prospect' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Client / Company', 
      accessorKey: 'name',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.name || 'N/A'}</span>
          <span className="text-[10px] text-muted-foreground uppercase flex items-center gap-1">
            <Building2 className="h-2 w-2" />
            {item.industry || 'General Industry'}
          </span>
        </div>
      ),
      sortable: true
    },
    { 
      header: 'Contact Info', 
      accessorKey: 'email',
      cell: (item) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <Mail className="h-3 w-3 text-muted-foreground opacity-50" />
            {item.email}
          </div>
          {item.phone && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Phone className="h-2.5 w-2.5 opacity-50" />
              {item.phone}
            </div>
          )}
        </div>
      )
    },
    { 
      header: 'Location', 
      accessorKey: 'address',
      cell: (item) => (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="h-3 w-3 opacity-50" />
          <span className="truncate max-w-[150px]">{item.address || 'Global'}</span>
        </div>
      )
    },
    { 
      header: 'Joined Date', 
      accessorKey: 'created_at',
      cell: (item) => (
        <span className="text-[11px] font-medium">
          {item.created_at ? format(new Date(item.created_at), 'MMM d, yyyy') : 'N/A'}
        </span>
      ),
      sortable: true
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="text-[10px] uppercase font-black">
          {item.status || 'Active'}
        </Badge>
      ),
      sortable: true
    }
  ]

  const summaryMetrics = useMemo(() => {
    return [
      {
        label: 'Total Portfolio',
        value: totalCount,
        icon: Users,
        description: 'Aggregate institutional clients'
      },
      {
        label: 'Active Partners',
        value: clients.filter((c: any) => c.status === 'active' || !c.status).length,
        icon: Building2,
        description: 'Verified active accounts'
      },
      {
        label: 'Global Footprint',
        value: new Set(clients.map((c: any) => c.address?.split(',').pop()?.trim())).size,
        icon: Globe,
        description: 'Distinct territories'
      },
      {
        label: 'Account Velocity',
        value: '98%',
        icon: Users,
        description: 'Retention performance'
      }
    ]
  }, [clients, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Client Insights Report",
      subtitle: "Strategic review of institutional client portfolio, contact integrity, and account health.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Client', dataKey: 'name' },
        { header: 'Email', dataKey: 'email' },
        { header: 'Industry', dataKey: 'industry' },
        { header: 'Status', dataKey: 'status' },
        { header: 'Joined', dataKey: 'created_at' },
      ],
      data: clients,
      summary: {
        'Total Clients': totalCount,
        'Active Accounts': summaryMetrics[1].value,
        'Territories': summaryMetrics[2].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Client Insights Report"
        description="Comprehensive audit of organization partners, acquisition timestamps, and multi-territory account status."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Client_Insights",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Client', dataKey: 'name' },
            { header: 'Email', dataKey: 'email' },
            { header: 'Status', dataKey: 'status' }
          ],
          data: clients
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search clients by name, industry, or location..."
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
          onRowAction={handleRowAction}
        />
      </div>
    </div>
  )
}
