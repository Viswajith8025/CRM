import { CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { DollarSign, TrendingUp } from 'lucide-react'
import { useBillingStore } from '@/modules/billing'
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { subDays, format } from 'date-fns'

export function RevenueWidget() {
  const { invoices, fetchInvoices } = useBillingStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    fetchInvoices()
    setIsMounted(true)
  }, [])

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(new Date(), 6 - i)
      return {
        date: d,
        name: format(d, 'EEE')
      }
    })

    return last7Days.map(day => {
      // Find all invoices for this specific day
      const dayInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.issued_at)
        return invDate.getDate() === day.date.getDate() &&
          invDate.getMonth() === day.date.getMonth() &&
          invDate.getFullYear() === day.date.getFullYear()
      })

      // 🟢 Actual Revenue (Invoices marked as PAID)
      const dailyPaid = dayInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.amount), 0)

      // 🔵 Total Invoiced (All statuses for this day)
      const dailyInvoiced = dayInvoices
        .reduce((sum, inv) => sum + Number(inv.amount), 0)

      return {
        name: day.name,
        revenue: dailyPaid,
        projected: dailyInvoiced
      }
    })
  }, [invoices])

  const totalPaid = useMemo(() => invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0), [invoices])
  const totalInvoiced = useMemo(() => invoices.reduce((sum, i) => sum + Number(i.amount), 0), [invoices])

  return (
    <div className="h-full flex flex-col bg-slate-950/50 rounded-xl overflow-hidden border border-white/5">
      <CardHeader className="pb-0 pt-6 px-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/40">Weekly Revenue Velocity</h3>
            <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Pipeline: ${totalInvoiced.toLocaleString()} total invoiced</p>
          </div>
          <div className="text-right">
             <div className="text-2xl font-black tracking-tighter text-white">${totalPaid.toLocaleString()}</div>
             <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-tighter">Paid Today</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 mt-4 min-h-[300px] w-full">
        <div className="w-full h-full aspect-[16/9] min-h-[300px]">
          {isMounted && (
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ffffff" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#ffffff44', fontSize: 10, fontWeight: 900 }}
                dy={10}
              />
              <YAxis hide />
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                labelStyle={{ color: '#ffffff44', fontSize: '10px', marginBottom: '4px' }}
              />
              <Area 
                type="monotone" 
                dataKey="projected" 
                name="Invoiced"
                stroke="#ffffff44" 
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={1} 
                fill="url(#colorProj)" 
                animationDuration={1500}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                name="Paid"
                stroke="#10b981" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorRev)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </CardContent>
    </div>
  )
}
