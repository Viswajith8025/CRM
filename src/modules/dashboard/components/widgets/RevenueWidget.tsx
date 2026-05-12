import { CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { DollarSign, TrendingUp } from 'lucide-react'
import { useBillingStore } from '@/modules/billing'
import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'
import { subDays, format } from 'date-fns'

import { isSameDay } from 'date-fns'

export function RevenueWidget() {
  const { invoices, fetchInvoices } = useBillingStore()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    // Force fetch with higher limit to ensure we have data for the week
    fetchInvoices({ limit: 100, force: true }) 
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
      const dayInvoices = invoices.filter(inv => {
        if (!inv.issued_at) return false
        const invDate = new Date(inv.issued_at)
        return isSameDay(invDate, day.date)
      })

      const dailyPaid = dayInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => sum + Number(inv.amount), 0)

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
    <div className="h-full flex flex-col bg-slate-950/40 rounded-3xl overflow-hidden border border-white/5 backdrop-blur-xl shadow-2xl">
      <CardHeader className="pb-4 pt-8 px-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5">
            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-white/40 flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              Weekly Revenue Velocity
            </h3>
            <div className="flex items-center gap-4">
              <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                Pipeline: <span className="text-white/40">${totalInvoiced.toLocaleString()}</span>
              </p>
              <div className="h-1 w-1 rounded-full bg-white/10" />
              <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                Last 7 Days
              </p>
            </div>
          </div>
          <div className="text-right">
             <div className="text-3xl font-black tracking-tighter text-white">${totalPaid.toLocaleString()}</div>
             <div className="text-[9px] text-emerald-400 font-black uppercase tracking-tighter bg-emerald-400/10 px-2 py-0.5 rounded-full inline-block">Paid Total</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 mt-2 w-full">
        <div className="w-full h-[280px]">
          {isMounted && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 30, bottom: 20 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
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
                tick={{ fill: '#ffffff33', fontSize: 10, fontWeight: 800 }}
                dy={15}
              />
              <YAxis hide domain={[0, 'auto']} padding={{ top: 40, bottom: 10 }} />
              <Tooltip 
                cursor={{ stroke: '#ffffff11', strokeWidth: 2 }}
                contentStyle={{ 
                  backgroundColor: '#020617', 
                  border: '1px solid #ffffff11', 
                  borderRadius: '16px',
                  boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' 
                }}
                itemStyle={{ fontSize: '12px', fontWeight: 'bold', padding: '2px 0' }}
                labelStyle={{ color: '#ffffff44', fontSize: '10px', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}
              />
              <Area 
                type="monotone" 
                dataKey="projected" 
                name="Invoiced"
                stroke="#ffffff22" 
                strokeWidth={2}
                strokeDasharray="8 8"
                fillOpacity={1} 
                fill="url(#colorProj)" 
                animationDuration={1500}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                name="Paid"
                stroke="#10b981" 
                strokeWidth={5}
                fillOpacity={1} 
                fill="url(#colorRev)" 
                dot={{ r: 5, fill: '#10b981', strokeWidth: 3, stroke: '#020617' }}
                activeDot={{ r: 8, strokeWidth: 0 }}
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
