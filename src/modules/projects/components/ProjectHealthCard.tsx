import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Activity, AlertTriangle, Clock, TrendingUp, DollarSign } from 'lucide-react'
import type { Project } from '../types'

interface ProjectHealthCardProps {
  project: Project
  className?: string
}

export function ProjectHealthCard({ project, className }: ProjectHealthCardProps) {
  const health = project.health

  if (!health) return null

  const statusColors = {
    'on-track': 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    'at-risk': 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    'delayed': 'text-rose-500 bg-rose-500/10 border-rose-500/20'
  }

  const statusIcons = {
    'on-track': Activity,
    'at-risk': TrendingUp,
    'delayed': AlertTriangle
  }

  const Icon = statusIcons[health.status]

  return (
    <div className={cn("p-6 rounded-2xl border bg-card/30 backdrop-blur-xl space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Project Health</h3>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Calculated based on real-time execution metrics</p>
        </div>
        <Badge className={cn("capitalize px-3 py-1 gap-1.5 font-bold", statusColors[health.status])}>
          <Icon className="h-3 w-3" />
          {health.status.replace('-', ' ')}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3 w-3" /> Overdue Tasks
          </div>
          <p className={cn("text-xl font-black", health.overdue_tasks > 0 ? "text-rose-500" : "text-emerald-500")}>
            {health.overdue_tasks}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3 w-3" /> Missed Milestones
          </div>
          <p className={cn("text-xl font-black", health.missed_milestones > 0 ? "text-rose-500" : "text-emerald-500")}>
            {health.missed_milestones}
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <DollarSign className="h-3 w-3" /> Budget Burn
          </div>
          <p className={cn("text-xl font-black", health.budget_burn > 90 ? "text-amber-500" : "text-emerald-500")}>
            {health.budget_burn}%
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <Activity className="h-3 w-3" /> Health Score
          </div>
          <p className={cn("text-xl font-black", 
            health.score > 80 ? "text-emerald-500" : 
            health.score > 60 ? "text-amber-500" : "text-rose-500"
          )}>
            {health.score}/100
          </p>
        </div>
      </div>

      {/* Visual Indicator Bar */}
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
        <div 
          className={cn("h-full transition-all duration-1000", 
            health.status === 'on-track' ? "bg-emerald-500" : 
            health.status === 'at-risk' ? "bg-amber-500" : "bg-rose-500"
          )}
          style={{ width: `${health.score}%` }}
        />
      </div>
    </div>
  )
}
