import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trash2, ExternalLink } from "lucide-react"
import { useTimeStore } from "../timeStore"
import { format } from "date-fns"

export function TimeLogList() {
  const { logs, isLoading, deleteLog } = useTimeStore()

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0m"
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Description</TableHead>
            <TableHead>Task / Project</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Billable</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                Loading logs...
              </TableCell>
            </TableRow>
          ) : logs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                No time logs found.
              </TableCell>
            </TableRow>
          ) : (
            logs.map((log) => (
              <TableRow key={log.id} className="group hover:bg-muted/50 transition-colors">
                <TableCell className="font-medium">
                  {log.description || "No description"}
                </TableCell>
                <TableCell>
                  {log.task ? (
                    <div className="flex flex-col">
                      <span className="text-sm">{log.task.title}</span>
                      <span className="text-xs text-muted-foreground">{log.task.project?.name}</span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs italic">General Work</span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {format(new Date(log.start_time), 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {formatDuration(log.duration_minutes)}
                </TableCell>
                <TableCell>
                  <Badge variant={log.is_billable ? "default" : "secondary"} className="text-[10px] uppercase">
                    {log.is_billable ? "Billable" : "Non-Billable"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => deleteLog(log.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
