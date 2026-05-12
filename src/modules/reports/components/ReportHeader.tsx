import { Button } from "@/components/ui/button"
import { Download, Printer, Calendar as CalendarIcon, FileSpreadsheet, FileText } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

interface ReportHeaderProps {
  title: string
  description: string
  onExportCSV?: () => void
  onExportPDF?: () => void
  onPrint?: () => void
}

export function ReportHeader({
  title,
  description,
  onExportCSV,
  onExportPDF,
  onPrint
}: ReportHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-8 border-b border-border/50 bg-card/50">
      <div>
        <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">{title}</h1>
        <p className="text-sm text-muted-foreground font-medium max-w-md">{description}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onPrint} className="h-9 gap-2 font-bold text-xs uppercase tracking-widest border-border/50 hover:bg-muted/50">
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9 gap-2 font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20">
              <Download className="h-3.5 w-3.5" />
              Export Data
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Select Format</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onExportCSV} className="gap-2 py-3 cursor-pointer">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold">Comma Separated (CSV)</span>
                <span className="text-[9px] text-muted-foreground">Best for Excel & Data Analysis</span>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExportPDF} className="gap-2 py-3 cursor-pointer">
              <FileText className="h-4 w-4 text-rose-500" />
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold">Portable Document (PDF)</span>
                <span className="text-[9px] text-muted-foreground">Best for Printing & Records</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
