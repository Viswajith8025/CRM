
import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface Metric {
  label: string
  value: string | number
  icon: LucideIcon
  description?: string
  trend?: {
    value: string
    positive: boolean
  }
}

interface ReportSummaryProps {
  metrics: Metric[]
}

export function ReportSummary({ metrics }: ReportSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-8 pt-8">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border-border/50 bg-card/30 shadow-none">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-1">
                  {metric.label}
                </p>
                <h3 className="text-2xl font-black tracking-tighter uppercase">{metric.value}</h3>
                {metric.description && (
                  <p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-tight">
                    {metric.description}
                  </p>
                )}
              </div>
              <div className="h-10 w-10 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-center">
                <metric.icon className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
            
            {metric.trend && (
              <div className="mt-4 flex items-center gap-2">
                <span className={cn(
                  "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full",
                  metric.trend.positive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}>
                  {metric.trend.positive ? '+' : '-'}{metric.trend.value}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">vs last period</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
