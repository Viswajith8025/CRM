import React, { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Settings2, ArrowUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  header: string
  accessorKey: keyof T | string
  cell?: (item: T) => React.ReactNode
  sortable?: boolean
}

interface ReportTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading?: boolean
  totalCount: number
  page: number
  limit: number
  onPageChange: (page: number) => void
  onSort?: (key: string, order: 'asc' | 'desc') => void
  onRowClick?: (item: T) => void
  stickyHeader?: boolean
}

export function ReportTable<T>({
  columns,
  data,
  isLoading,
  totalCount,
  page,
  limit,
  onPageChange,
  onSort,
  onRowClick,
  stickyHeader = true
}: ReportTableProps<T>) {
  const [visibleColumns, setVisibleColumns] = useState<string[]>(columns.map(c => c.header))
  const [sortConfig, setSortConfig] = useState<{ key: string; order: 'asc' | 'desc' } | null>(null)

  const handleSort = (key: string) => {
    const order = sortConfig?.key === key && sortConfig.order === 'asc' ? 'desc' : 'asc'
    setSortConfig({ key, order })
    onSort?.(key, order)
  }

  const filteredColumns = columns.filter(c => visibleColumns.includes(c.header))
  const totalPages = Math.ceil(totalCount / limit)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Showing {Math.min(data.length, limit)} of {totalCount.toLocaleString()} records
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2 border-dashed">
              <Settings2 className="h-3.5 w-3.5" />
              Columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            {columns.map((column) => (
              <DropdownMenuCheckboxItem
                key={column.header}
                className="capitalize text-xs font-bold"
                checked={visibleColumns.includes(column.header)}
                onCheckedChange={(value) => {
                  if (value) setVisibleColumns([...visibleColumns, column.header])
                  else setVisibleColumns(visibleColumns.filter(c => c !== column.header))
                }}
              >
                {column.header}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={cn(
        "rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden",
        stickyHeader && "relative"
      )}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className={cn(stickyHeader && "sticky top-0 bg-background/80 backdrop-blur-md z-10")}>
              <TableRow className="bg-muted/30 border-b border-border/50">
                {filteredColumns.map((column) => (
                  <TableHead 
                    key={column.header}
                    className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4"
                  >
                    {column.sortable ? (
                      <button 
                        onClick={() => handleSort(column.accessorKey as string)}
                        className="flex items-center gap-1.5 hover:text-primary transition-colors"
                      >
                        {column.header}
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    ) : (
                      column.header
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {filteredColumns.map((_, j) => (
                      <TableCell key={j} className="py-4">
                        <div className="h-4 w-full bg-muted/50 animate-pulse rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={filteredColumns.length} className="h-32 text-center text-muted-foreground font-medium">
                    No records found matching your filters.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item, i) => (
                  <TableRow 
                    key={i} 
                    className={cn(
                      "hover:bg-muted/20 transition-colors group",
                      onRowClick && "cursor-pointer"
                    )}
                    onClick={() => onRowClick?.(item)}
                  >
                    {filteredColumns.map((column) => (
                      <TableCell key={column.header} className="py-3.5 text-sm font-medium">
                        {column.cell ? column.cell(item) : (item[column.accessorKey as keyof T] as React.ReactNode)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-end gap-4 px-2">
        <div className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground">
          Page {page} of {totalPages || 1}
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages || isLoading}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
