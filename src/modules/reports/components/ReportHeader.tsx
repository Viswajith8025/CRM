
import { Button } from "@/components/ui/button"
import { Printer, Download, Share2, ChevronLeft, FileSpreadsheet } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"

interface ReportHeaderProps {
  title: string
  description?: string
  onPrint?: () => void
  onExportPDF?: () => void
  onExportCSV?: () => void
  className?: string
}

export function ReportHeader({
  title,
  description,
  onPrint,
  onExportPDF,
  onExportCSV,
  className
}: ReportHeaderProps) {
  const navigate = useNavigate()

  return (
    <div className={cn("bg-background border-b border-border/50 px-8 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10", className)}>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate('/reports')}
          className="h-10 w-10 rounded-full border border-border/50 flex items-center justify-center hover:bg-muted transition-colors shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">{title}</h1>
          {description && (
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-2 opacity-70 leading-relaxed max-w-2xl">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onPrint}
          className="font-bold uppercase tracking-tighter text-[10px] h-9 gap-2 border-border/50"
        >
          <Printer className="h-3.5 w-3.5" />
          Print
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onExportCSV}
          className="font-bold uppercase tracking-tighter text-[10px] h-9 gap-2 border-border/50"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
          CSV
        </Button>
        <Button 
          size="sm" 
          onClick={onExportPDF}
          className="font-bold uppercase tracking-tighter text-[10px] h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
        >
          <Download className="h-3.5 w-3.5" />
          Export PDF
        </Button>
      </div>
    </div>
  )
}
