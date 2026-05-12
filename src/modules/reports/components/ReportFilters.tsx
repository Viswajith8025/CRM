import { useState, useEffect } from "react"
import { Search, Filter, X, Calendar as CalendarIcon } from "lucide-react"
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
  onSearch: (value: string) => void
  onFilterChange: (filters: Record<string, any>) => void
  options: FilterOption[]
  activeFilters: Record<string, any>
  searchPlaceholder?: string
}

export function ReportFilters({
  onSearch,
  onFilterChange,
  options,
  activeFilters,
  searchPlaceholder = "Search records..."
}: ReportFiltersProps) {
  const [searchValue, setSearchValue] = useState("")
  
  // Debounce search
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

  const clearFilters = () => {
    onFilterChange({})
    setSearchValue("")
  }

  const hasActiveFilters = Object.keys(activeFilters).length > 0 || searchValue !== ""

  return (
    <div className="space-y-4 p-6 bg-muted/20 border-y border-border/50">
      <div className="flex flex-wrap items-center gap-4">
        {/* Search */}
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            className="pl-9 h-10 bg-background"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>

        {/* Dynamic Filters */}
        {options.map((option) => (
          <div key={option.value} className="w-[200px]">
            {option.type === 'select' ? (
              <Select
                value={activeFilters[option.value] || 'all'}
                onValueChange={(val) => handleFilterChange(option.value, val)}
              >
                <SelectTrigger className="h-10 bg-background font-bold text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <Filter className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{option.label}:</span>
                    <SelectValue placeholder="All" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All {option.label}</SelectItem>
                  {option.options?.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : option.type === 'date' ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 w-full bg-background justify-start text-left font-bold text-xs gap-2"
                  >
                    <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{option.label}:</span>
                    {activeFilters[option.value] 
                      ? format(new Date(activeFilters[option.value]), 'PP')
                      : 'Pick date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={activeFilters[option.value] ? new Date(activeFilters[option.value]) : undefined}
                    onSelect={(date) => handleFilterChange(option.value, date?.toISOString())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            ) : null}
          </div>
        ))}

        {hasActiveFilters && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearFilters}
            className="text-xs font-black uppercase tracking-widest text-rose-500 hover:text-rose-600 hover:bg-rose-500/5"
          >
            <X className="h-3.5 w-3.5 mr-2" />
            Reset Filters
          </Button>
        )}
      </div>

      {/* Active Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {searchValue && (
            <Badge variant="secondary" className="gap-1 pl-2 pr-1 h-6 font-bold text-[10px] uppercase">
              Search: {searchValue}
              <X className="h-3 w-3 cursor-pointer" onClick={() => setSearchValue("")} />
            </Badge>
          )}
          {Object.entries(activeFilters).map(([key, value]) => {
            const option = options.find(o => o.value === key)
            if (!option) return null
            const displayValue = option.type === 'date' 
              ? format(new Date(value), 'MMM d, yyyy')
              : option.options?.find(o => o.value === value)?.label || value
            
            return (
              <Badge key={key} variant="secondary" className="gap-1 pl-2 pr-1 h-6 font-bold text-[10px] uppercase">
                {option.label}: {displayValue}
                <X className="h-3 w-3 cursor-pointer" onClick={() => handleFilterChange(key, null)} />
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}
