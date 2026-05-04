import { CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { DollarSign, TrendingUp } from 'lucide-react'
import { useBillingStore } from '@/modules/billing/billingStore'
import { useEffect, useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { subDays, format } from 'date-fns'

export function RevenueWidget() {
  const { invoices, fetchInvoices } = useBillingStore()

  useEffect(() => {
    fetchInvoices()
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
      const dailyRev = invoices
        .filter(inv => {
          const invDate = new Date(inv.issued_at)
          return inv.status === 'paid' &&
            invDate.getDate() === day.date.getDate() &&
            invDate.getMonth() === day.date.getMonth() &&
            invDate.getFullYear() === day.date.getFullYear()
        })
        .reduce((sum, inv) => sum + Number(inv.amount), 0)

      return {
        name: day.name,
        revenue: dailyRev
      }
    })
  }, [invoices])

  const totalPaid = invoices
    .filter(inv => inv.status === 'paid')
    .reduce((sum, inv) => sum + Number(inv.amount), 0)

  return (
    <div className="h-full flex flex-col bg-slate-950/50 rounded-xl overflow-hidden border border-white/5">
      <CardHeader className="pb-0 pt-6 px-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/40">Weekly Revenue Velocity</h3>
            <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">Daily cash flow from paid invoices</p>
          </div>
          <div className="text-right">
             <div className="text-2xl font-black tracking-tighter text-white">${totalPaid.toLocaleString()}</div>
             <div className="text-[10px] text-emerald-400 font-bold flex items-center justify-end gap-1">
               <TrendingUp className="h-3 w-3" /> +14.2%
             </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 mt-4 h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffffff" stopOpacity={0.3}/>
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
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#ffffff" 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorRev)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </div>
  )
}
