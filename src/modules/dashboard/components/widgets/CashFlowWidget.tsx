import { CardHeader, CardContent } from '@/components/ui/card'
import { ShieldCheck } from 'lucide-react'
import { useBillingStore } from '@/modules/billing'
import { useEffect, useMemo, useState, useRef } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

export function CashFlowWidget() {
  const [isReady, setIsReady] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const { invoices, fetchInvoices } = useBillingStore()

  useEffect(() => {
    fetchInvoices()
    
    const el = chartContainerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setTimeout(() => setIsReady(true), 200)
          observer.disconnect()
        }
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const data = useMemo(() => {
    const paid = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.amount), 0)
    const outstanding = invoices.filter(i => i.status === 'sent' || i.status === 'overdue' || i.status === 'partially_paid').reduce((sum, i) => sum + Number(i.amount), 0)
    
    return [
      { name: 'Liquid Assets', value: paid, color: '#0ea5e9' },
      { name: 'Receivables', value: outstanding, color: '#7dd3fc' }
    ]
  }, [invoices])

  const total = data.reduce((sum, item) => sum + item.value, 0)
  const healthRatio = total > 0 ? Math.round((data[0].value / total) * 100) : 0

  return (
    <div className="h-full flex flex-col bg-card rounded-2xl border border-border/40 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-0 pt-6 px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-primary/60 flex items-center gap-2">
            <ShieldCheck className="h-3 w-3 text-primary" />
            Financial Liquidity
          </h3>
          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 px-6 pb-6 flex items-center justify-between gap-6">
        <div ref={chartContainerRef} className="w-[140px] h-[140px] relative shrink-0 block">
          {isReady && (
            <>
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                <span className="text-2xl font-black text-foreground leading-none">{healthRatio}%</span>
                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Health</span>
              </div>
              <PieChart width={140} height={140}>
                <Pie
                  data={data}
                  innerRadius={52}
                  outerRadius={65}
                  paddingAngle={6}
                  dataKey="value"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e0f2fe', borderRadius: '12px', fontSize: '11px' }}
                  itemStyle={{ color: '#0369a1', fontWeight: 'bold' }}
                />
              </PieChart>
            </>
          )}
        </div>
        
        <div className="flex-1 space-y-4">
          {data.map(item => (
            <div key={item.name} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{item.name}</span>
                </div>
                <span className="text-xs font-black text-slate-700">${item.value.toLocaleString()}</span>
              </div>
              <div className="h-1.5 w-full bg-sky-50 rounded-full overflow-hidden border border-sky-100">
                <div
                  className="h-full transition-all duration-1000 rounded-full"
                  style={{
                    width: `${total > 0 ? (item.value / total) * 100 : 0}%`,
                    backgroundColor: item.color
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </div>
  )
}
