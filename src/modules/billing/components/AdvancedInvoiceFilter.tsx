import React, { useState } from 'react'
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Filter, Search, X, SlidersHorizontal, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface FilterCriteria {
  minAmount?: number
  maxAmount?: number
  status?: string
  clientName?: string
  dateFrom?: string
  dateTo?: string
}

interface AdvancedInvoiceFilterProps {
  onFilterChange: (criteria: FilterCriteria) => void
}

export function AdvancedInvoiceFilter({ onFilterChange }: AdvancedInvoiceFilterProps) {
  const [criteria, setCriteria] = useState<FilterCriteria>({})
  const [activeCount, setActiveCount] = useState(0)

  const handleApply = () => {
    const count = Object.values(criteria).filter(v => v !== undefined && v !== '').length
    setActiveCount(count)
    onFilterChange(criteria)
  }

  const handleReset = () => {
    setCriteria({})
    setActiveCount(0)
    onFilterChange({})
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2 h-10 font-bold border-border/50 bg-card/50 relative">
          <SlidersHorizontal className="h-4 w-4" />
          Advanced Filters
          {activeCount > 0 && (
            <Badge className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-6 rounded-2xl bg-card/80 backdrop-blur-xl border-border/50 shadow-2xl" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-3 mb-2">
            <h4 className="font-black text-sm uppercase tracking-widest">Filter Engine</h4>
            <Button variant="ghost" size="sm" className="h-8 text-[10px] font-bold uppercase" onClick={handleReset}>Reset</Button>
          </div>

          <div className="space-y-4">
            {/* Amount Range */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount Range</Label>
              <div className="flex items-center gap-2">
                <Input 
                  type="number" 
                  placeholder="Min" 
                  className="h-9 text-xs" 
                  value={criteria.minAmount || ''}
                  onChange={(e) => setCriteria({...criteria, minAmount: e.target.value ? Number(e.target.value) : undefined})}
                />
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-30" />
                <Input 
                  type="number" 
                  placeholder="Max" 
                  className="h-9 text-xs" 
                  value={criteria.maxAmount || ''}
                  onChange={(e) => setCriteria({...criteria, maxAmount: e.target.value ? Number(e.target.value) : undefined})}
                />
              </div>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</Label>
              <Select value={criteria.status || 'all'} onValueChange={(val) => setCriteria({...criteria, status: val === 'all' ? undefined : val})}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Client Name */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Name</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="Search client..." 
                  className="pl-9 h-9 text-xs"
                  value={criteria.clientName || ''}
                  onChange={(e) => setCriteria({...criteria, clientName: e.target.value})}
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Due Date From</Label>
              <Input 
                type="date" 
                className="h-9 text-xs" 
                value={criteria.dateFrom || ''}
                onChange={(e) => setCriteria({...criteria, dateFrom: e.target.value})}
              />
            </div>
          </div>

          <Button className="w-full mt-4 font-black uppercase tracking-widest h-10 shadow-lg" onClick={handleApply}>
            Apply Filters
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
