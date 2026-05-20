
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
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Eye, Edit, Download, Trash2, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Column<T> {
  header: string
  accessorKey: keyof T | string
  cell?: (item: T) => React.ReactNode
  sortable?: boolean
}

export type RowAction = 'view' | 'edit' | 'download' | 'delete' | 'summary'

interface ReportTableProps<T> {
  columns: Column<T>[]
  data: T[]
  isLoading: boolean
  totalCount: number
  page: number
  limit: number
  onPageChange: (page: number) => void
  onSort?: (key: string, order: 'asc' | 'desc') => void
  onRowAction?: (action: RowAction, item: T) => void
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
  onRowAction
}: ReportTableProps<T>) {
  const totalPages = Math.ceil(totalCount / limit)
  const startRange = (page - 1) * limit + 1
  const endRange = Math.min(page * limit, totalCount)

  return (
    <div className="border border-border/50 rounded-2xl bg-card/30 overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/50">
              {columns.map((col) => (
                <TableHead 
                  key={String(col.accessorKey)}
                  className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground py-4"
                >
                  {col.header}
                </TableHead>
              ))}
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-64 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">Compiling Report Data...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-64 text-center">
                  <p className="text-sm font-bold text-muted-foreground">No records found for this criteria.</p>
                </TableCell>
              </TableRow>
            ) : (
              data.map((item: any, idx) => (
                <TableRow key={item.id || idx} className="border-border/50 hover:bg-primary/[0.02] group transition-colors">
                  {columns.map((col) => (
                    <TableCell key={String(col.accessorKey)} className="py-4 font-medium text-sm">
                      {col.cell ? col.cell(item) : String(item[col.accessorKey] ?? '-')}
                    </TableCell>
                  ))}
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 rounded-lg border border-border/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted focus-visible:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel className="text-[10px] font-black uppercase tracking-widest opacity-60">Record Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onRowAction?.('view', item)} className="gap-2 cursor-pointer">
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-bold text-xs uppercase tracking-tight">View Details</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRowAction?.('edit', item)} className="gap-2 cursor-pointer">
                          <Edit className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-bold text-xs uppercase tracking-tight">Edit Record</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRowAction?.('summary', item)} className="gap-2 cursor-pointer">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-bold text-xs uppercase tracking-tight">Individual Report</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRowAction?.('download', item)} className="gap-2 cursor-pointer">
                          <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-bold text-xs uppercase tracking-tight">Export Row</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onRowAction?.('delete', item)} className="gap-2 cursor-pointer text-rose-500 focus:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="font-bold text-xs uppercase tracking-tight">Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="bg-muted/10 border-t border-border/50 px-6 py-4 flex items-center justify-between">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
          Showing <span className="text-foreground">{startRange}-{endRange}</span> of <span className="text-foreground">{totalCount}</span> institutional records
        </p>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            disabled={page === 1 || isLoading}
            onClick={() => onPageChange(page - 1)}
            className="h-8 w-8 p-0 border-border/50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-1 px-2">
            <span className="text-[10px] font-black">PAGE {page}</span>
            <span className="text-[10px] font-black text-muted-foreground">/ {totalPages || 1}</span>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            disabled={page === totalPages || totalPages === 0 || isLoading}
            onClick={() => onPageChange(page + 1)}
            className="h-8 w-8 p-0 border-border/50"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
