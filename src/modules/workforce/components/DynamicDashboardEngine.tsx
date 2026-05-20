import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, BarChart, PieChart, TrendingUp, Users, Target, Briefcase } from 'lucide-react'
import type { KPI, DashboardLayout } from '../types'
import { useWorkforceStore } from '../store/workforceStore'

const ICON_MAP: Record<string, any> = {
  'activity': Activity,
  'trending': TrendingUp,
  'users': Users,
  'target': Target,
  'briefcase': Briefcase,
}

interface DynamicDashboardEngineProps {
  layout: DashboardLayout | null
  kpis: KPI[]
  department: string
}

export function DynamicDashboardEngine({ layout, kpis, department }: DynamicDashboardEngineProps) {
  // If we have a layout config, we can map over it.
  // For now, if no layout config exists in DB, we use the fallback hardcoded arrays from the prompt.

  // Helper to find KPI by key
  const getKPI = (key: string) => kpis.find(k => k.kpi_key === key)

  if (!layout) {
    return <DefaultFallbackDashboard department={department} kpis={kpis} />
  }

  // Assuming layout.layout_config has { sections: [ { title, widgets: [{ kpi_key, size }] } ] }
  return (
    <div className="space-y-6">
      {layout.layout_config?.sections?.map((section: any, idx: number) => (
        <div key={idx} className="space-y-4">
          <h3 className="text-lg font-black tracking-tight text-slate-800">{section.title}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {section.widgets?.map((widget: any, wIdx: number) => {
              const kpi = getKPI(widget.kpi_key)
              if (!kpi) return null
              
              if (kpi.visualization_type === 'metric_card') {
                return <DynamicMetricCard key={wIdx} kpi={kpi} />
              }
              // Render other types...
              return (
                <Card key={wIdx} className="bg-card/40 border-border/40 backdrop-blur-sm lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                      {kpi.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="h-[250px] flex items-center justify-center border-t border-border/10">
                    <span className="text-xs text-muted-foreground">{kpi.visualization_type} (Lazy Loaded)</span>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function DynamicMetricCard({ kpi }: { kpi: KPI }) {
  // Mock fetching value from the data_source_rpc
  const value = "..."
  const Icon = Activity

  return (
    <Card className="bg-card/40 border-border/40 backdrop-blur-md hover:border-primary/50 transition-all">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`p-2 rounded-lg bg-background/50 text-primary`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{kpi.name}</h3>
          <div className="text-2xl font-black tracking-tighter">{value}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// Fallback logic exactly aligned to the prompt's requirements
function DefaultFallbackDashboard({ department, kpis }: { department: string, kpis: KPI[] }) {
  const getCards = () => {
    switch (department) {
      case 'sales':
        return [
          { title: "Calls Connected", value: "142", icon: Activity, color: "text-sky-500" },
          { title: "Meetings Scheduled", value: "18", icon: Users, color: "text-indigo-500" },
          { title: "Proposals Sent", value: "12", icon: Target, color: "text-emerald-500" },
          { title: "Lead Conversion %", value: "24%", icon: TrendingUp, color: "text-amber-500" },
          { title: "Closed Deals", value: "8", icon: Briefcase, color: "text-emerald-500" }
        ]
      case 'development':
        return [
          { title: "Active Projects", value: "4", icon: Briefcase, color: "text-sky-500" },
          { title: "Assigned Tasks", value: "28", icon: Activity, color: "text-indigo-500" },
          { title: "Completed Tasks", value: "15", icon: Target, color: "text-emerald-500" },
          { title: "Sprint Progress", value: "65%", icon: TrendingUp, color: "text-amber-500" }
        ]
      case 'design':
        return [
          { title: "Assigned Designs", value: "12", icon: Activity, color: "text-sky-500" },
          { title: "Pending Reviews", value: "5", icon: Users, color: "text-amber-500" },
          { title: "Approved Designs", value: "8", icon: Target, color: "text-emerald-500" },
          { title: "Revision Count", value: "3", icon: TrendingUp, color: "text-rose-500" }
        ]
      case 'seo':
        return [
          { title: "Active Campaigns", value: "6", icon: Activity, color: "text-sky-500" },
          { title: "Deliverables Pending", value: "14", icon: Users, color: "text-amber-500" },
          { title: "Completed Reports", value: "8", icon: Target, color: "text-emerald-500" },
          { title: "Keyword Tasks", value: "24", icon: TrendingUp, color: "text-indigo-500" }
        ]
      case 'content':
        return [
          { title: "Assigned Content", value: "18", icon: Activity, color: "text-sky-500" },
          { title: "Articles Completed", value: "12", icon: Target, color: "text-emerald-500" },
          { title: "Pending Reviews", value: "6", icon: Users, color: "text-amber-500" },
          { title: "Revision Requests", value: "2", icon: TrendingUp, color: "text-rose-500" }
        ]
      default:
        return [
          { title: "Total Workload", value: "100%", icon: Activity, color: "text-slate-500" }
        ]
    }
  }

  const cards = getCards()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <Card key={i} className="bg-card/40 border-border/40 backdrop-blur-md hover:border-primary/50 transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className={`p-2 rounded-lg bg-background/50 ${c.color}`}>
                  <c.icon className="h-5 w-5" />
                </div>
              </div>
              <div className="space-y-1">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{c.title}</h3>
                <div className="text-2xl font-black tracking-tighter">{c.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Workload Distribution</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center border-t border-border/10">
            <span className="text-xs text-muted-foreground">Dynamic Chart Component (Lazy Loaded)</span>
          </CardContent>
        </Card>
        <Card className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground">Performance Trends</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] flex items-center justify-center border-t border-border/10">
            <span className="text-xs text-muted-foreground">Dynamic Trend Chart (Lazy Loaded)</span>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
