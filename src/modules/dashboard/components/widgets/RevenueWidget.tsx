import { CardHeader, CardContent } from '@/components/ui/card'
import { TrendingUp, ArrowUpRight } from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip,
  CartesianGrid
} from 'recharts'
import { useDashboardDataStore } from '@/modules/dashboard'

export function RevenueWidget() {
  const [isReady, setIsReady] = useState(false)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const { stats, chartData, fetchDashboardData } = useDashboardDataStore()

  useEffect(() => {
    if (!stats) fetchDashboardData()
    
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

  const totalPaid = stats?.revenue || 0
  
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-sky-200 p-3 rounded-xl shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-2">{label}</p>
          <div className="space-y-1.5">
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs font-semibold text-slate-600">{entry.name}</span>
                </div>
                <span className="text-xs font-black text-sky-600">${Number(entry.value).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="h-full flex flex-col bg-card rounded-2xl overflow-hidden border border-border/40 shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4 pt-6 px-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary/60">
                Revenue Velocity
              </h3>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-black tracking-tighter text-foreground">
                ${totalPaid.toLocaleString()}
              </span>
              <div className="flex items-center gap-1 text-primary text-[10px] font-black bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                <ArrowUpRight className="h-3 w-3" />
                +12.5%
              </div>
            </div>
          </div>
          <div className="text-right space-y-1">
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Status</p>
            <div className="text-[9px] text-primary font-black uppercase tracking-wider bg-primary/10 px-3 py-1 rounded-full border border-primary/20">Operational</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 w-full mt-2">
        <div ref={chartContainerRef} style={{ width: '100%', height: 280 }}>
          {isReady && (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorProj" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7dd3fc" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#7dd3fc" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e0f2fe" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 700 }}
                  dy={10}
                  interval="preserveStartEnd"
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#bae6fd', strokeWidth: 1 }} />
                
                <Area 
                  type="monotone" 
                  dataKey="projected" 
                  name="Pipeline"
                  stroke="#7dd3fc" 
                  strokeWidth={2}
                  strokeDasharray="8 6"
                  fillOpacity={1} 
                  fill="url(#colorProj)" 
                  animationDuration={1500}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  name="Actual Revenue"
                  stroke="#0ea5e9" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                  dot={false}
                  activeDot={{ r: 5, fill: '#0ea5e9', stroke: '#fff', strokeWidth: 2 }}
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
