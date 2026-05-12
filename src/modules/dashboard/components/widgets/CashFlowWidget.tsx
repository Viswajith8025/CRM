import { CardHeader, CardContent } from '@/components/ui/card'
import { Activity, DollarSign } from 'lucide-react'
import { useBillingStore } from '@/modules/billing'
import { useEffect, useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export function CashFlowWidget() {
  const { invoices, fetchInvoices } = useBillingStore()

  useEffect(() => {
    fetchInvoices()
  }, [])

  const data = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0)
    const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue').reduce((sum, i) => sum + Number(i.amount), 0)
    
    return [
      { name: 'Paid', value: paid, color: '#10b981' },
      { name: 'Outstanding', value: outstanding, color: '#f59e0b' }
    ]
  }, [invoices])

  const total = data.reduce((sum, item) => sum + item.value, 0)
  const healthRatio = total > 0 ? Math.round((data[0].value / total) * 100) : 0

  return (
    <div className="h-full flex flex-col bg-slate-950/20 rounded-xl border border-white/5">
      <CardHeader className="pb-0 pt-6 px-6">
        <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/60 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-500" />
          Cash Flow Health
        </h3>
      </CardHeader>
      <CardContent className="flex-1 px-6 pb-6 flex items-center justify-between">
        <div className="w-1/2 h-[150px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <PieChart>
              <Pie
                data={data}
                innerRadius={40}
                outerRadius={55}
                paddingAngle={5}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                itemStyle={{ color: '#fff', fontSize: '10px', fontWeight: 'bold' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="w-1/2 space-y-4">
          <div className="space-y-1">
             <p className="text-[10px] font-black uppercase tracking-widest text-white/30">Health Score</p>
             <div className="text-3xl font-black text-white">{healthRatio}%</div>
          </div>
          <div className="space-y-2">
            {data.map(item => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] font-bold text-white/40 uppercase">{item.name}</span>
                </div>
                <span className="text-xs font-black text-white">${item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </div>
  )
}
