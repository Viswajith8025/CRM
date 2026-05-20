import { useState, useEffect } from "react"
import { useTasksStore } from "../tasksStore"
import { useTeamStore } from "@/modules/admin/teamStore"
import type { Profile } from "@/modules/admin/teamStore"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  AlertTriangle,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  UserPlus,
  RefreshCw,
  FolderLock
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

const STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  blocked: "Blocked",
  completed: "Completed",
  done: "Done",
}

const STATUS_BG: Record<string, string> = {
  todo: "bg-slate-500",
  in_progress: "bg-blue-500",
  review: "bg-violet-500",
  blocked: "bg-rose-500",
  completed: "bg-emerald-500",
  done: "bg-emerald-500",
}

export function WorkloadBoard() {
  const { tasks, fetchTasks, updateTask } = useTasksStore()
  const { members, fetchMembers, isLoading: teamLoading } = useTeamStore()
  
  const activeMembers = members.filter(m => m.status === 'active' && m.role === 'employee')
  
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [allTasks, setAllTasks] = useState<any[]>([])

  const fetchWorkloadTasks = async () => {
    try {
      const { profile: currentUser } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = currentUser?.organization_id
      if (!orgId) return

      const { data, error } = await supabase
        .from('tasks')
        .select('*, project:projects(id, name)')
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .or('is_archived.is.null,is_archived.eq.false')

      if (error) throw error
      setAllTasks(data || [])
    } catch (err) {
      console.error("Failed to load workload tasks:", err)
    }
  }

  useEffect(() => {
    fetchMembers()
    fetchTasks() // triggers store sync
  }, [])

  // Keep allTasks in sync with any task updates or realtime notifications
  useEffect(() => {
    fetchWorkloadTasks()
  }, [tasks])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([fetchWorkloadTasks(), fetchMembers()])
      toast.success("Workload status refreshed")
    } catch (err: any) {
      toast.error("Failed to refresh status data")
    } finally {
      setIsRefreshing(false)
    }
  }

  // Calculate detailed allocation data for each team member
  const memberWorkloads = activeMembers.map(member => {
    // Filter active (non-completed / non-done) tasks assigned to this member
    const memberTasks = allTasks.filter(t => t.assigned_to === member.id)
    const activeTasks = memberTasks.filter(t => t.status !== "completed" && t.status !== "done")
    
    // Total estimated hours of active tasks
    const totalEstHours = memberTasks.reduce((acc, t) => {
      // Don't count finished tasks towards active workload
      if (t.status === "completed" || t.status === "done") return acc
      return acc + (t.estimated_hours || 0)
    }, 0)

    // Weekly capacity
    const capacity = 40 // Default standard capacity
    const percentAllocated = Math.round((totalEstHours / capacity) * 100)
    const isOverAllocated = totalEstHours > capacity

    // Breakdown counts
    const statusCounts = memberTasks.reduce((acc: Record<string, number>, t) => {
      const status = t.status || "todo"
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})

    return {
      member,
      tasks: memberTasks,
      activeTasksCount: activeTasks.length,
      totalEstHours,
      capacity,
      percentAllocated,
      isOverAllocated,
      statusCounts,
    }
  })

  // Global workload summary
  const overAllocatedCount = memberWorkloads.filter(w => w.isOverAllocated).length
  const totalAllocatedHours = memberWorkloads.reduce((acc, w) => acc + w.totalEstHours, 0)
  const unassignedTasks = allTasks.filter(t => !t.assigned_to && t.status !== "completed" && t.status !== "done")

  const handleReassign = async (taskId: string, newMemberId: string) => {
    try {
      const targetId = newMemberId === "unassigned" ? null : newMemberId
      await updateTask(taskId, { assigned_to: targetId })
      await fetchWorkloadTasks()
      toast.success("Task successfully reassigned!")
      
      // Update selected profile's task lists dynamically
      if (selectedMember) {
        const stillSelected = activeMembers.find(m => m.id === selectedMember.id)
        if (stillSelected) {
          setSelectedMember(stillSelected)
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to reassign task")
    }
  }

  return (
    <div className="space-y-6">
      {/* Visual Workload Stats Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric Card 1 */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Team Size</span>
            <h3 className="text-2xl font-black">{activeMembers.length} Members</h3>
          </div>
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <Users className="h-5 w-5" />
          </div>
        </div>

        {/* Metric Card 2 */}
        <div className="bg-card/40 border border-border/50 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Total Backlog Est.</span>
            <h3 className="text-2xl font-black text-sky-500">{totalAllocatedHours} hrs</h3>
          </div>
          <div className="p-3 rounded-xl bg-sky-500/10 text-sky-500">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        {/* Metric Card 3 */}
        <div className={cn(
          "border rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300",
          overAllocatedCount > 0 
            ? "bg-rose-500/5 border-rose-500/30 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.05)] animate-pulse" 
            : "bg-card/40 border-border/50"
        )}>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Over-allocated Team</span>
            <h3 className="text-2xl font-black">{overAllocatedCount} Overloaded</h3>
          </div>
          <div className={cn(
            "p-3 rounded-xl",
            overAllocatedCount > 0 ? "bg-rose-500/20 text-rose-500" : "bg-muted text-muted-foreground"
          )}>
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Metric Card 4 */}
        <div className={cn(
          "border rounded-2xl p-4 flex items-center justify-between shadow-sm",
          unassignedTasks.length > 0
            ? "bg-amber-500/5 border-amber-500/30 text-amber-500"
            : "bg-card/40 border-border/50"
        )}>
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Unassigned Tasks</span>
            <h3 className="text-2xl font-black">{unassignedTasks.length} Pending</h3>
          </div>
          <div className={cn(
            "p-3 rounded-xl",
            unassignedTasks.length > 0 ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"
          )}>
            <UserPlus className="h-5 w-5" />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Resource Allocation Dashboard
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage weekly task limits and capacity thresholds to maintain optimum work balance.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={isRefreshing || teamLoading}
          className="gap-1.5 h-8 text-[11px] font-bold"
        >
          <RefreshCw className={cn("h-3 w-3", (isRefreshing || teamLoading) && "animate-spin")} />
          Sync Board
        </Button>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {memberWorkloads.map(({ member, tasks: mTasks, activeTasksCount, totalEstHours, capacity, percentAllocated, isOverAllocated, statusCounts }) => {
          return (
            <div
              key={member.id}
              onClick={() => {
                setSelectedMember(member)
                setIsDetailOpen(true)
              }}
              className={cn(
                "group relative overflow-hidden rounded-2xl border p-5 cursor-pointer bg-card/40 hover:bg-card hover:border-border/80 transition-all duration-300 shadow-sm",
                isOverAllocated 
                  ? "border-rose-500/30 hover:border-rose-500/50 shadow-[0_0_15px_rgba(244,63,94,0.03)]" 
                  : "border-border/50"
              )}
            >
              {/* Dynamic Gradient glow behind over-allocated profiles */}
              {isOverAllocated && (
                <div className="absolute inset-0 -z-10 bg-gradient-to-tr from-rose-500/5 via-transparent to-transparent opacity-60 pointer-events-none" />
              )}

              {/* Employee info header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-border">
                    <AvatarImage src={member.avatar_url || ""} />
                    <AvatarFallback className="font-black text-xs bg-primary/10 text-primary">
                      {member.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black truncate">{member.full_name || "Unnamed User"}</h4>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider block mt-0.5">
                      {member.dynamic_role_name || member.role || "Team Member"}
                    </span>
                    {member.department && (
                      <span className="text-[9px] font-bold text-sky-500 uppercase tracking-widest block mt-0.5">
                        {member.department}
                      </span>
                    )}
                  </div>
                </div>

                {/* Over allocation Alert Flag */}
                {isOverAllocated ? (
                  <Badge className="bg-rose-500 hover:bg-rose-600 text-[9px] font-black uppercase tracking-wider h-5 flex items-center gap-1 shadow-md shadow-rose-500/20">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Over-Allocated
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] font-bold text-muted-foreground border-border/80 h-5">
                    Balanced
                  </Badge>
                )}
              </div>

              {/* Weekly load metrics */}
              <div className="mt-5 space-y-3.5">
                <div className="flex justify-between items-end text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase font-black tracking-wider">Weekly Load</span>
                    <p className="font-black text-sm">
                      {totalEstHours}h <span className="text-muted-foreground font-normal">/ {capacity}h limit</span>
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-black",
                    percentAllocated > 100 ? "text-rose-500" : percentAllocated > 75 ? "text-amber-500" : "text-emerald-500"
                  )}>
                    {percentAllocated}%
                  </span>
                </div>

                {/* Progress Allocation Bar */}
                <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${Math.min(percentAllocated, 100)}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      percentAllocated > 100 
                        ? "bg-gradient-to-r from-rose-500 to-rose-600 shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse" 
                        : percentAllocated > 75 
                        ? "bg-gradient-to-r from-amber-400 to-amber-500" 
                        : "bg-gradient-to-r from-emerald-400 to-emerald-500"
                    )}
                  />
                </div>
              </div>

              {/* Status Segment Breakdowns */}
              <div className="mt-5 pt-4 border-t border-border/40 space-y-2">
                <span className="text-[9px] text-muted-foreground uppercase font-black tracking-wider block">
                  Task Status Distribution
                </span>
                
                {mTasks.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground italic py-1">No tasks assigned currently</p>
                ) : (
                  <div className="flex gap-1.5 flex-wrap">
                    {Object.entries(STATUS_LABELS).map(([status, label]) => {
                      const count = statusCounts[status] || 0
                      if (count === 0) return null
                      return (
                        <div key={status} className="flex items-center gap-1 text-[9px] font-bold bg-muted/50 px-2 py-0.5 rounded-md border border-border/30">
                          <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_BG[status])} />
                          <span className="text-muted-foreground">{label}:</span>
                          <span>{count}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Hover indicator link */}
              <div className="mt-4 pt-3 text-[10px] font-black uppercase text-primary tracking-widest text-right opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
                View Allocation Profile &rarr;
              </div>
            </div>
          )
        })}
      </div>

      {/* Slide-over Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl bg-card/95 border border-border/80 shadow-2xl">
          {selectedMember && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-black flex items-center gap-2">
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={selectedMember.avatar_url || ""} />
                    <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                      {selectedMember.full_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <span className="block font-black">{selectedMember.full_name || "Unnamed User"}</span>
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest block">
                      {selectedMember.dynamic_role_name || selectedMember.role || "Team Member"} {selectedMember.department ? `— ${selectedMember.department}` : ""} — WORKLOAD BREAKOUT
                    </span>
                  </div>
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Detailed task breakouts and quick reallocation manager.
                </DialogDescription>
              </DialogHeader>

              {/* Tasks list inside the breakout dialog */}
              <div className="space-y-4 my-2">
                <div className="max-h-[380px] overflow-y-auto space-y-3.5 pr-2">
                  {allTasks.filter(t => t.assigned_to === selectedMember.id).length === 0 ? (
                    <div className="py-12 text-center border border-dashed rounded-2xl">
                      <FolderLock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2.5" />
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Clean Slate: No active tasks
                      </p>
                    </div>
                  ) : (
                    allTasks.filter(t => t.assigned_to === selectedMember.id).map(task => {
                      const isFinished = task.status === "completed" || task.status === "done"
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-all",
                            isFinished && "opacity-50"
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                              {task.project_name || "Global Workspace"}
                            </span>
                            <h5 className={cn("text-xs font-black truncate mt-0.5", isFinished && "line-through text-muted-foreground")}>
                              {task.title}
                            </h5>
                            
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={cn("text-[9px] h-4 font-black uppercase", STATUS_BG[task.status || "todo"])}>
                                {STATUS_LABELS[task.status || "todo"]}
                              </Badge>
                              {task.estimated_hours && (
                                <Badge variant="outline" className="text-[9px] h-4 font-bold border-border/80 bg-background/50">
                                  {task.estimated_hours} hrs est.
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Quick reassign controls */}
                          <div className="w-full sm:w-48 shrink-0 space-y-1">
                            <label className="text-[9px] uppercase font-black tracking-wider text-muted-foreground block">
                              Reallocate Task
                            </label>
                            <Select
                              defaultValue={selectedMember.id}
                              onValueChange={(val) => handleReassign(task.id, val)}
                            >
                              <SelectTrigger className="h-8 text-[11px] font-bold bg-background border border-border/80">
                                <SelectValue placeholder="Reassign..." />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">
                                  <span className="text-[11px] font-bold text-amber-500 flex items-center gap-1">
                                    ⚠️ Leave Unassigned
                                  </span>
                                </SelectItem>
                                {activeMembers.map(m => (
                                  <SelectItem key={m.id} value={m.id} disabled={m.id === selectedMember.id}>
                                    <span className="text-[11px] font-bold">
                                      {m.full_name} {m.id === selectedMember.id ? "(Current)" : ""}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
                <Button size="sm" variant="outline" onClick={() => setIsDetailOpen(false)} className="font-bold">
                  Close Breakout
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
