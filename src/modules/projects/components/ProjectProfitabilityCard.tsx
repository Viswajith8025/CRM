import React from 'react'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { DollarSign, TrendingUp, TrendingDown, Users, Receipt, Briefcase } from 'lucide-react'
import type { Project } from '../types'

interface ProjectProfitabilityCardProps {
  project: Project
  className?: string
}

export function ProjectProfitabilityCard({ project, className }: ProjectProfitabilityCardProps) {
  const financials = project.financials

  if (!financials) return null

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val)
  }

  const isProfitable = financials.profit >= 0

  return (
    <Card className={cn("overflow-hidden border-border/50 bg-card/30 backdrop-blur-xl", className)}>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Profitability Analysis</h3>
            <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Revenue vs Operational Costs</p>
          </div>
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            isProfitable ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
          )}>
            {isProfitable ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-blue-500" />
              </div>
              <span className="text-xs font-bold">Total Revenue</span>
            </div>
            <span className="text-sm font-black text-blue-500">{formatCurrency(financials.revenue)}</span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">
              <span>Operational Costs</span>
              <span>{formatCurrency(financials.labor_cost + financials.expense_total)}</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span>Labor Cost</span>
                </div>
                <span>{formatCurrency(financials.labor_cost)}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-2">
                  <Receipt className="h-3 w-3 text-muted-foreground" />
                  <span>Expenses</span>
                </div>
                <span>{formatCurrency(financials.expense_total)}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50 mt-2">
            <div className="flex items-center justify-between mb-4">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Net Profit</span>
                <p className={cn("text-2xl font-black", isProfitable ? "text-emerald-500" : "text-rose-500")}>
                  {formatCurrency(financials.profit)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Margin</span>
                <p className={cn("text-lg font-black", isProfitable ? "text-emerald-500" : "text-rose-500")}>
                  {financials.profit_margin}%
                </p>
              </div>
            </div>

            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-1000", isProfitable ? "bg-emerald-500" : "bg-rose-500")}
                style={{ width: `${Math.max(0, Math.min(100, financials.profit_margin + 50))}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
