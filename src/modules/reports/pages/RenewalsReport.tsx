
import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { ReportExportService } from "../services/ReportExportService"
import { useAuthStore } from "@/store/useAuthStore"
import { RefreshCw, Calendar, DollarSign, AlertCircle, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { format, isBefore, addDays } from "date-fns"
import { useNavigate } from "react-router-dom"
import { type RowAction } from "../components/ReportTable"
import { toast } from "sonner"

export default function RenewalsReport() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()

  const handleRowAction = (action: RowAction, item: any) => {
    switch (action) {
      case 'view':
      case 'summary':
        toast.success(`Generating detailed renewal audit for ${item.description}`)
        ReportExportService.exportSingleRecord(
          `Renewal Audit - ${item.description}`,
          item,
          profile?.organization_name || "ECRAFTZ"
        )
        break
      case 'edit':
        toast.success(`Redirecting to renewals module`)
        navigate(`/renewals?search=${encodeURIComponent(item.description || '')}`)
        break
      case 'download':
        toast.success(`Exporting row data...`)
        ReportExportService.exportToCSV({
          title: "Renewal_Record_Export",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: columns.map(c => ({ header: c.header, dataKey: c.accessorKey })),
          data: [item]
        })
        break
      case 'delete':
        toast.error(`Audit records are protected by organization retention policies.`)
        break
    }
  }
  
  const { 
    data: renewals, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    filters, 
    setFilters, 
    setSearch 
  } = useReport<any>({
    tableName: 'renewals',
    select: '*, client:clients(name), project:projects(name)',
    pageSize: 20,
    searchFields: ['description', 'category', 'status']
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Category',
      value: 'category',
      type: 'select',
      options: [
        { label: 'Hosting', value: 'hosting' },
        { label: 'Domain', value: 'domain' },
        { label: 'Mail', value: 'mail' },
        { label: 'Hosting & Domain', value: 'hosting_domain' },
      ]
    },
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Sent', value: 'sent' },
        { label: 'Paid', value: 'paid' },
        { label: 'Overdue', value: 'overdue' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Service Detail', 
      accessorKey: 'description',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.description}</span>
          <span className="text-[10px] text-muted-foreground uppercase font-medium">
            {item.client?.name} {item.project?.name && `• ${item.project.name}`}
          </span>
        </div>
      )
    },
    { 
      header: 'Category', 
      accessorKey: 'category',
      cell: (item) => <Badge variant="outline" className="text-[10px] uppercase font-black">{item.category?.replace('_', ' & ')}</Badge>
    },
    { 
      header: 'Expiry Date', 
      accessorKey: 'expiry_date',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold text-[11px]">{format(new Date(item.expiry_date), 'MMM d, yyyy')}</span>
          {isBefore(new Date(item.expiry_date), addDays(new Date(), 30)) && item.status !== 'paid' && (
            <span className="text-[9px] text-rose-500 font-black uppercase">Critical Window</span>
          )}
        </div>
      )
    },
    { 
      header: 'Value', 
      accessorKey: 'amount',
      cell: (item) => <span className="font-black text-foreground">₹{Number(item.amount || 0).toLocaleString()}</span>
    },
    { 
      header: 'Reminders', 
      accessorKey: 'reminders_sent',
      cell: (item) => (
        <Badge variant="secondary" className="text-[10px] font-bold">
          {item.reminders_sent || 0} SENT
        </Badge>
      )
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge 
          variant={item.status === 'paid' ? 'default' : item.status === 'overdue' ? 'destructive' : 'secondary'} 
          className="text-[10px] uppercase font-black"
        >
          {item.status}
        </Badge>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const totalValue = renewals.reduce((sum, r) => sum + Number(r.amount || 0), 0)
    const criticalCount = renewals.filter(r => r.status !== 'paid' && isBefore(new Date(r.expiry_date), addDays(new Date(), 30))).length
    const collectionRate = renewals.length > 0 ? (renewals.filter(r => r.status === 'paid').length / renewals.length) * 100 : 0

    return [
      {
        label: 'Renewal Matrix',
        value: totalCount,
        icon: RefreshCw,
        description: 'Total active assets'
      },
      {
        label: 'Pipeline Value',
        value: `₹${totalValue.toLocaleString()}`,
        icon: DollarSign,
        description: 'Managed asset volume'
      },
      {
        label: 'Critical Window',
        value: criticalCount,
        icon: AlertCircle,
        description: 'Expiring < 30 days'
      },
      {
        label: 'Collection Rate',
        value: `${Math.round(collectionRate)}%`,
        icon: CheckCircle2,
        description: 'Current period health'
      }
    ]
  }, [renewals, totalCount])

  const handleExportPDF = () => {
    ReportExportService.exportToPDF({
      title: "Asset Renewal & Lifecycle Audit",
      subtitle: "Comprehensive review of recurring service expirations, collection velocity, and institutional liability tracking.",
      organizationName: profile?.organization_name || "ECRAFTZ ERP",
      columns: [
        { header: 'Service', dataKey: 'description' },
        { header: 'Category', dataKey: 'category' },
        { header: 'Expiry', dataKey: 'expiry_date' },
        { header: 'Value', dataKey: 'amount' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: renewals,
      summary: {
        'Managed Assets': totalCount,
        'Portfolio Value': summaryMetrics[1].value,
        'Critical Alerts': summaryMetrics[2].value
      },
      filters
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <ReportHeader 
        title="Operations: Renewals Matrix"
        description="Forensic tracking of service lifecycles, renewal collection rates, and proactive notification auditing."
        onExportPDF={handleExportPDF}
        onExportCSV={() => ReportExportService.exportToCSV({
          title: "Asset_Renewals_Audit",
          organizationName: profile?.organization_name || "ECRAFTZ",
          columns: [
            { header: 'Service', dataKey: 'description' },
            { header: 'Value', dataKey: 'amount' },
            { header: 'Status', dataKey: 'status' },
            { header: 'Expiry', dataKey: 'expiry_date' }
          ],
          data: renewals
        })}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        searchPlaceholder="Search renewals by service, client, or project..."
      />

      <div className="p-8">
        <ReportTable 
          columns={columns}
          data={renewals}
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
