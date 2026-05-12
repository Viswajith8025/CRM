import { useMemo } from "react"
import { ReportHeader } from "../components/ReportHeader"
import { ReportSummary } from "../components/ReportSummary"
import { ReportFilters, type FilterOption } from "../components/ReportFilters"
import { ReportTable, type Column } from "../components/ReportTable"
import { useReport } from "../hooks/useReport"
import { Target, TrendingUp, Users, DollarSign } from "lucide-react"
import { format } from "date-fns"
import { exportToCSV } from "@/lib/exportUtils"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function CRMReport() {
  const { 
    data: leads, 
    isLoading, 
    totalCount, 
    page, 
    setPage, 
    setFilters, 
    setSearch, 
    setSort,
    filters 
  } = useReport<any>({
    tableName: 'leads',
    select: '*',
    pageSize: 15
  })

  const filterOptions: FilterOption[] = [
    {
      label: 'Status',
      value: 'status',
      type: 'select',
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Qualified', value: 'qualified' },
        { label: 'Converted', value: 'converted' },
        { label: 'Lost', value: 'lost' },
      ]
    },
    {
      label: 'Source',
      value: 'source',
      type: 'select',
      options: [
        { label: 'Website', value: 'Website' },
        { label: 'Referral', value: 'Referral' },
        { label: 'Social Media', value: 'Social Media' },
      ]
    }
  ]

  const columns: Column<any>[] = [
    { 
      header: 'Created At', 
      accessorKey: 'created_at',
      cell: (item) => format(new Date(item.created_at), 'MMM dd, yyyy'),
      sortable: true
    },
    { 
      header: 'Lead Name', 
      accessorKey: 'first_name',
      cell: (item) => (
        <div className="flex flex-col">
          <span className="font-bold">{item.first_name} {item.last_name}</span>
          <span className="text-[10px] text-muted-foreground">{item.email}</span>
        </div>
      ),
      sortable: true
    },
    { 
      header: 'Phone', 
      accessorKey: 'phone',
      cell: (item) => item.phone || 'N/A'
    },
    { 
      header: 'Status', 
      accessorKey: 'status',
      cell: (item) => (
        <Badge variant="outline" className="text-[9px] uppercase font-black px-1.5 border-primary/20 bg-primary/5">
          {item.status || 'New'}
        </Badge>
      ),
      sortable: true
    },
    { 
      header: 'Industry', 
      accessorKey: 'industry',
      cell: (item) => <span className="text-xs font-medium uppercase">{item.industry || 'N/A'}</span>
    },
    { 
      header: 'Estimated Value', 
      accessorKey: 'value',
      cell: (item) => <span className="font-black text-primary">₹{(item.value || 0).toLocaleString()}</span>,
      sortable: true
    },
    { 
      header: 'Source', 
      accessorKey: 'source',
      cell: (item) => (
        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          {item.source || 'Direct'}
        </span>
      )
    }
  ]

  const summaryMetrics = useMemo(() => {
    const totalValue = leads.reduce((sum: number, lead: any) => sum + (Number(lead.value) || 0), 0)
    const activeLeads = leads.filter((l: any) => l.status !== 'converted' && l.status !== 'lost').length

    return [
      {
        label: 'Total Leads',
        value: totalCount.toString(),
        icon: Users,
        color: 'primary',
        description: 'Global lead database'
      },
      {
        label: 'Active Pipeline',
        value: activeLeads.toString(),
        icon: Target,
        color: 'blue',
        description: 'Ongoing negotiations'
      },
      {
        label: 'Pipeline Value',
        value: `₹${totalValue.toLocaleString()}`,
        icon: DollarSign,
        color: 'emerald',
        description: 'Potential revenue'
      },
      {
        label: 'Conversion Rate',
        value: `${((leads.filter((l: any) => l.status === 'converted').length / (totalCount || 1)) * 100).toFixed(1)}%`,
        icon: TrendingUp,
        color: 'indigo',
        description: 'Efficiency metric'
      }
    ]
  }, [leads, totalCount])

  const handleExportCSV = () => {
    const exportData = leads.map((l: any) => ({
      Date: format(new Date(l.created_at), 'yyyy-MM-dd'),
      Name: `${l.first_name} ${l.last_name}`,
      Email: l.email,
      Status: l.status,
      Value: l.value,
      Source: l.source
    }))
    exportToCSV(exportData, `CRM_Audit_${format(new Date(), 'yyyy-MM-dd')}`)
    toast.success("CSV Export started")
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-20">
      <ReportHeader 
        title="CRM Strategic Audit"
        description="Comprehensive analysis of sales pipeline, lead acquisition sources, and conversion efficiency."
        onExportCSV={handleExportCSV}
        onPrint={() => window.print()}
      />
      
      <ReportSummary metrics={summaryMetrics} />
      
      <ReportFilters 
        title="Lead Acquisition Records"
        description="Detailed audit of all incoming business opportunities and status tracking"
        options={filterOptions}
        activeFilters={filters}
        onFilterChange={setFilters}
        onSearch={setSearch}
        onExportCSV={handleExportCSV}
        onExportPDF={() => toast.info("PDF Engine initializing...")}
        searchPlaceholder="Search leads by name, email or company..."
      />

      <div className="px-8 py-4">
        <ReportTable 
          columns={columns}
          data={leads}
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
