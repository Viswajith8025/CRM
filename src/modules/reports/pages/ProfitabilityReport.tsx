import React, { useEffect, useState } from 'react'
import { PageWrapper } from '@/components/shared/PageWrapper'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Receipt,
  Download,
  Filter,
  RefreshCcw,
  BarChart3,
  Percent
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend
} from 'recharts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ProjectExpenseModal } from '../components/ProjectExpenseModal'

export default function ProfitabilityReport() {
  const [data, setData] = useState<ProfitabilityData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [expenseModal, setExpenseModal] = useState<{ open: boolean; projectId?: string }>({ open: false })

  const fetchProfitability = async () => {
    setIsLoading(true)
    try {
      const { data: result, error } = await supabase.rpc('get_project_profitability')
      if (error) throw error
      setData(result)
    } catch (err) {
      console.error("Profitability engine error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchProfitability()
  }, [])

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val)
  }

  const totals = {
    revenue: data.reduce((acc, curr) => acc + curr.total_revenue, 0),
    profit: data.reduce((acc, curr) => acc + curr.profit, 0),
    costs: data.reduce((acc, curr) => acc + curr.total_cost, 0),
    hours: data.reduce((acc, curr) => acc + curr.billable_hours, 0)
  }

  return (
    <PageWrapper 
      title="Project Profitability" 
      description="Deep dive into project-level financial performance, labor costs, and margins."
      actions={
        <div className="flex gap-2">
          <Button
            className="gap-2 font-black uppercase tracking-wider text-xs"
            onClick={() => setExpenseModal({ open: true })}
          >
            <Receipt className="h-4 w-4" />
            Add Expense
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => {}}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchProfitability} disabled={isLoading}>
            <RefreshCcw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      }
    >
      {/* High-Level Totals */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card className="border-border/50 bg-card/30 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{formatCurrency(totals.revenue)}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Profit</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{formatCurrency(totals.profit)}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Labor/Expenses</CardTitle>
            <Receipt className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">{formatCurrency(totals.costs)}</div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/30 backdrop-blur-xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Avg Margin</CardTitle>
            <Percent className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black">
              {data.length > 0 ? Math.round((totals.profit / totals.revenue) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Comparison Chart */}
        <Card className="border-border/50 bg-card/30 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Revenue vs Profit</CardTitle>
            <CardDescription>Top projects by verified revenue</CardDescription>
          </CardHeader>
          <CardContent className="h-[400px] w-full pt-4">
            {!isLoading && data.length > 0 && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#ffffff10" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                  <YAxis dataKey="project_name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} width={120} />
                  <Tooltip 
                    cursor={{ fill: '#ffffff05' }}
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                  />
                  <Legend />
                  <Bar dataKey="total_revenue" name="Revenue" fill="#10b981" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="profit" name="Net Profit" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
            {!isLoading && data.length === 0 && (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                No profitability data available yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card className="border-border/50 bg-card/30 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Detailed Breakdown</CardTitle>
            <CardDescription>Labor costs and expense metrics per project</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/20">
                    <th className="p-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Project</th>
                    <th className="p-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Revenue</th>
                    <th className="p-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Labor</th>
                    <th className="p-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Expenses</th>
                    <th className="p-4 font-black uppercase tracking-widest text-[10px] text-muted-foreground">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {data.map((item) => (
                    <tr key={item.project_id} className="group hover:bg-muted/10 transition-colors">
                      <td className="p-4 font-bold truncate max-w-[200px]">{item.project_name}</td>
                      <td className="p-4 font-mono font-medium">{formatCurrency(item.total_revenue)}</td>
                      <td className="p-4 font-mono text-muted-foreground">{formatCurrency(item.labor_cost)}</td>
                      <td className="p-4 font-mono text-muted-foreground">{formatCurrency(item.expense_total)}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            "text-xs font-black px-2 py-1 rounded-md",
                            item.margin_percentage > 30 ? "bg-emerald-500/10 text-emerald-500" :
                            item.margin_percentage > 10 ? "bg-blue-500/10 text-blue-500" :
                            "bg-rose-500/10 text-rose-500"
                          )}>
                            {item.margin_percentage}%
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[9px] font-black uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity text-amber-500 hover:bg-amber-500/10"
                            onClick={() => setExpenseModal({ open: true, projectId: item.project_id })}
                          >
                            + Expense
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <ProjectExpenseModal
        open={expenseModal.open}
        onOpenChange={(open) => setExpenseModal({ open })}
        defaultProjectId={expenseModal.projectId}
        onSuccess={fetchProfitability}
      />
    </PageWrapper>
  )
}
