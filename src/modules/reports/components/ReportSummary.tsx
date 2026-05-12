import { Card, CardContent } from "@/components/ui/card"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SummaryMetric {
  label: string
  value: string | number
  icon: LucideIcon
  description?: string
  color?: 'primary' | 'emerald' | 'rose' | 'amber' | 'blue'
  trend?: {
    value: string
    positive: boolean
  }
}

interface ReportSummaryProps {
  metrics: SummaryMetric[]
}

export function ReportSummary({ metrics }: ReportSummaryProps) {
  const colorMap = {
    primary: "text-primary bg-primary/10",
    emerald: "text-emerald-600 bg-emerald-500/10",
    rose: "text-rose-600 bg-rose-500/10",
    amber: "text-amber-600 bg-amber-500/10",
    blue: "text-blue-600 bg-blue-500/10",
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-6 bg-muted/5">
      {metrics.map((metric) => (
        <Card key={metric.label} className="border-border/50 bg-card shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                {metric.label}
              </p>
              <div className="flex items-baseline gap-2">
                <h3 className={cn(
                  "text-2xl font-black tracking-tight",
                  metric.color === 'rose' && "text-rose-600",
                  metric.color === 'emerald' && "text-emerald-600"
                )}>
                  {metric.value}
                </h3>
              </div>
              {metric.description && (
                <p className="text-[10px] font-medium text-muted-foreground">
                  {metric.description}
                </p>
              )}
            </div>

            <div className={cn(
              "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
              colorMap[metric.color || 'primary']
            )}>
              <metric.icon className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
