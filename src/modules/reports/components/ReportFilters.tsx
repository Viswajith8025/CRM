import { useState, useEffect } from "react"
import { Search, Filter, X, Calendar as CalendarIcon, FileSpreadsheet, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"

export interface FilterOption {
  label: string
  value: string
  options?: { label: string; value: string }[]
  type: 'select' | 'date' | 'text'
}

interface ReportFiltersProps {
  title: string
  description?: string
  onSearch: (value: string) => void
  onFilterChange: (filters: Record<string, any>) => void
  onExportCSV?: () => void
  onExportPDF?: () => void
  options: FilterOption[]
  activeFilters: Record<string, any>
  searchPlaceholder?: string
}

export function ReportFilters({
  title,
  description,
  onSearch,
  onFilterChange,
  onExportCSV,
  onExportPDF,
  options,
  activeFilters,
  searchPlaceholder = "Search records..."
}: ReportFiltersProps) {
  const [searchValue, setSearchValue] = useState("")
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(searchValue)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchValue])

  const handleFilterChange = (key: string, value: any) => {
    const newFilters = { ...activeFilters, [key]: value }
    if (value === 'all' || !value) delete newFilters[key]
    onFilterChange(newFilters)
  }

  const hasActiveFilters = Object.keys(activeFilters).length > 0 || searchValue !== ""

  return (
    <div className="bg-background px-8 py-4 border-b border-border/50">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* LEFT: TITLE */}
        <div>
          <h2 className="text-lg font-black tracking-tight">{title}</h2>
          {description && <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{description}</p>}
        </div>

        {/* RIGHT: FILTERS & EXPORTS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filters */}
          {options.map((option) => (
            <div key={option.value} className="min-w-[140px]">
              <Select
                value={activeFilters[option.value] || 'all'}
                onValueChange={(val) => handleFilterChange(option.value, val)}
              >
                <SelectTrigger className="h-8 bg-muted/30 border-border/50 text-[10px] font-bold uppercase">
                  <div className="flex items-center gap-1.5 truncate">
                    <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
                    <SelectValue placeholder={`All ${option.label}`} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-[10px] uppercase font-bold">All {option.label}</SelectItem>
                  {option.options?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-[10px] uppercase font-bold">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {/* Export Buttons (matching screenshot) */}
          <div className="flex items-center gap-1 ml-2 border-l border-border/50 pl-2">
            <Button variant="outline" size="sm" onClick={onExportCSV} className="h-8 gap-1.5 text-[10px] font-black uppercase border-border/50 hover:bg-emerald-50 hover:text-emerald-600 transition-colors">
              <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportPDF} className="h-8 gap-1.5 text-[10px] font-black uppercase border-border/50 hover:bg-rose-50 hover:text-rose-600 transition-colors">
              <FileText className="h-3.5 w-3.5 text-rose-500" />
              PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Active Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 mt-3">
          {searchValue && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1 h-5 font-bold text-[9px] uppercase tracking-tighter">
              Search: {searchValue}
              <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => setSearchValue("")} />
            </Badge>
          )}
          {Object.entries(activeFilters).map(([key, value]) => {
            const option = options.find(o => o.value === key)
            if (!option) return null
            const displayValue = option.options?.find(o => o.value === value)?.label || value
            return (
              <Badge key={key} variant="secondary" className="gap-1 pl-2 pr-1 h-5 font-bold text-[9px] uppercase tracking-tighter">
                {option.label}: {displayValue}
                <X className="h-2.5 w-2.5 cursor-pointer" onClick={() => handleFilterChange(key, null)} />
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
