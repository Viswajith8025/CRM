
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Filter, X, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState } from "react"

export interface FilterOption {
  label: string
  value: string
  type: 'select' | 'date' | 'search'
  options?: { label: string; value: string }[]
}

interface ReportFiltersProps {
  options: FilterOption[]
  activeFilters: Record<string, any>
  onFilterChange: (filters: Record<string, any>) => void
  onSearch: (query: string) => void
  searchPlaceholder?: string
}

export function ReportFilters({
  options,
  activeFilters,
  onFilterChange,
  onSearch,
  searchPlaceholder = "Search records..."
}: ReportFiltersProps) {
  const [searchValue, setSearchValue] = useState("")

  const handleClear = () => {
    onFilterChange({})
    onSearch("")
    setSearchValue("")
  }

  return (
    <div className="px-8 pt-8 flex flex-col md:flex-row md:items-center gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
        <Input 
          placeholder={searchPlaceholder}
          className="pl-10 h-11 border-border/50 bg-card/30 font-medium text-sm"
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value)
            onSearch(e.target.value)
          }}
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
        {options.map((opt) => (
          <div key={opt.value} className="shrink-0">
            {opt.type === 'select' ? (
              <Select 
                value={activeFilters[opt.value] || ""} 
                onValueChange={(val) => onFilterChange({ ...activeFilters, [opt.value]: val })}
              >
                <SelectTrigger className="h-11 min-w-[140px] border-border/50 bg-card/30 font-bold uppercase tracking-tighter text-[10px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-3 w-3 opacity-50" />
                    <SelectValue placeholder={opt.label} />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {opt.options?.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-[10px] font-bold uppercase">
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : opt.type === 'date' ? (
              <Input 
                type="date"
                className="h-11 border-border/50 bg-card/30 font-bold uppercase tracking-tighter text-[10px] w-[180px]"
                onChange={(e) => onFilterChange({ ...activeFilters, [opt.value]: e.target.value })}
              />
            ) : null}
          </div>
        ))}

        {(Object.keys(activeFilters).length > 0 || searchValue) && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleClear}
            className="h-11 px-4 gap-2 font-black uppercase tracking-widest text-[9px] text-rose-500 hover:bg-rose-500/10"
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
