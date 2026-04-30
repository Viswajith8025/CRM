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
import { Input } from "@/components/ui/input"
import { Trash2, Filter, Search, Edit2 } from "lucide-react"
import { useTimeStore } from "../timeStore"
import { format } from "date-fns"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { TimeLogForm } from "./TimeLogForm"
import { toast } from "sonner"

export function TimeLogList() {
  const { logs, isLoading, deleteLog } = useTimeStore()
  const [search, setSearch] = useState("")
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  const [editingLog, setEditingLog] = useState<any>(null)

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0m"
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const filteredLogs = logs
    .filter((log) => 
      log.description?.toLowerCase().includes(search.toLowerCase()) ||
      log.task?.title?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const valA = new Date(a.start_time).getTime()
      const valB = new Date(b.start_time).getTime()
      return sortOrder === "asc" ? valA - valB : valB - valA
    })

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search logs by description or task..." 
            className="pl-9" 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button 
          variant="outline" 
          className="gap-2"
          onClick={() => setSortOrder(prev => prev === "asc" ? "desc" : "asc")}
        >
          <Filter className="h-4 w-4" />
          Sort Date: {sortOrder === "asc" ? "Oldest First" : "Newest First"}
        </Button>
      </div>

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
          ) : filteredLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                No time logs found.
              </TableCell>
            </TableRow>
          ) : (
            filteredLogs.map((log) => (
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
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => setEditingLog(log)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Time Log</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this time entry? This cannot be undone and will affect billable hours.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => deleteLog(log.id)}
                            className="bg-rose-500 hover:bg-rose-600 text-white"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>

    <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Time Log</DialogTitle>
        </DialogHeader>
        {editingLog && (
          <TimeLogForm 
            log={editingLog} 
            onSuccess={() => setEditingLog(null)} 
          />
        )}
      </DialogContent>
    </Dialog>
  </div>
)
}
