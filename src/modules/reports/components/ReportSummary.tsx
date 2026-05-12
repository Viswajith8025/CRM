import { Card, CardContent } from "@/components/ui/card"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SummaryMetric {
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
  metrics: SummaryMetric[]
}

export function ReportSummary({ metrics }: ReportSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-6">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border-border/50 bg-card/50 shadow-sm overflow-hidden relative group transition-all hover:border-primary/20 hover:shadow-lg">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <metric.icon className="h-16 w-16 text-primary" />
          </div>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <metric.icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {metric.label}
              </span>
            </div>
            
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight">{metric.value}</span>
              {metric.trend && (
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded",
                  metric.trend.positive ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                )}>
                  {metric.trend.positive ? "+" : ""}{metric.trend.value}
                </span>
              )}
            </div>
            
            {metric.description && (
              <p className="text-[10px] font-bold text-muted-foreground mt-2 uppercase tracking-tighter opacity-70">
                {metric.description}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
