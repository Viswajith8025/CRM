import { useState, useEffect, useMemo } from "react"
import { useProjectsStore } from "../projectsStore"
import { useTasksStore } from "@/modules/tasks"
import { useTeamStore } from "@/modules/admin/teamStore"
import type { ProjectModule } from "../projectsStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Plus, Layers, ChevronRight, ChevronDown, Trash2, Pencil, FolderOpen,
  Calendar, User2, Flag, CheckCircle2, Circle, AlertCircle, Loader2, Play, Pause, Timer
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, isPast, isToday } from "date-fns"
import { toast } from "sonner"
import TaskForm from "@/modules/tasks/components/TaskForm"
import { useTimeStore } from "@/modules/time-tracking/timeStore"
import { useTimeDeskStore } from "@/modules/time-tracking/timeDeskStore"

const MODULE_COLORS = [
  { label: "Indigo", value: "#6366f1" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Violet", value: "#8b5cf6" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Emerald", value: "#10b981" },
  { label: "Cyan", value: "#06b6d4" },
  { label: "Slate", value: "#64748b" },
]

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-rose-500/10 text-rose-500 border-rose-500/30",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  medium: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  low: "bg-slate-500/10 text-slate-400 border-slate-500/20",
}

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-slate-500/10 text-slate-400",
  in_progress: "bg-blue-500/10 text-blue-500",
  review: "bg-violet-500/10 text-violet-500",
  blocked: "bg-rose-500/10 text-rose-500",
  completed: "bg-emerald-500/10 text-emerald-500",
  done: "bg-emerald-500/10 text-emerald-500",
}

interface ModulesTabProps {
  projectId: string
  canManage: boolean
}

interface ModuleFormData {
  name: string
  description: string
  color: string
  parent_id: string | null
  assigned_to?: string | null
}

const defaultForm: ModuleFormData = { name: "", description: "", color: "#6366f1", parent_id: null, assigned_to: null }

export function ModulesTab({ projectId, canManage }: ModulesTabProps) {
  const { modules, fetchModules, addModule, updateModule, deleteModule, projects } = useProjectsStore()
  const { fetchTasks, tasks, updateTask } = useTasksStore()
  const { members, fetchMembers } = useTeamStore()

  const project = projects.find(p => p.id === projectId)
  const projectDeptId = project?.department_id

  const eligibleModuleMembers = useMemo(() => {
    const activeEmployees = members.filter(m => (!m.status || m.status === 'active') && m.role === 'employee')
    if (!projectDeptId) {
      return activeEmployees
    }
    return activeEmployees.filter(m => m.department_id === projectDeptId)
  }, [members, projectDeptId])

  // Time Desk Integration
  const { activeTimer, startTimer, stopTimer } = useTimeStore()
  const { activeSession, checkIn } = useTimeDeskStore()
  const [timeTicker, setTimeTicker] = useState(0)

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set())
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [isModuleDialogOpen, setIsModuleDialogOpen] = useState(false)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<ProjectModule | null>(null)
  const [form, setForm] = useState<ModuleFormData>(defaultForm)
  const [parentForSub, setParentForSub] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null)

  const projectModules = modules[projectId] || []
  const projectTasks = tasks.filter(t => t.project_id === projectId)

  useEffect(() => {
    fetchModules(projectId)
    fetchTasks({ projectId })
    fetchMembers()
  }, [projectId])

  // Active Timer live duration ticking hook
  useEffect(() => {
    let interval: any
    if (activeTimer) {
      interval = setInterval(() => {
        setTimeTicker(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [activeTimer])

  const getElapsedDuration = (startTime: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(startTime).getTime()) / 1000)
    if (diff < 0) return "00:00"
    const hrs = Math.floor(diff / 3600)
    const mins = Math.floor((diff % 3600) / 60)
    const secs = diff % 60
    
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleStartTaskTimer = async (task: any) => {
    try {
      if (!activeSession) {
        toast.info("Clocking you into shift automatically...")
        await checkIn()
      }
      startTimer({
        task_id: task.id,
        start_time: new Date().toISOString(),
        description: `Working on module task: ${task.title}`,
        is_billable: true
      })
      toast.success(`Focus period started for: ${task.title}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to start timer")
    }
  }

  const handleStopTaskTimer = async () => {
    try {
      await stopTimer()
      toast.success("Timer stopped and focus hours recorded!")
    } catch (err: any) {
      toast.error(err.message || "Failed to stop timer")
    }
  }

  const handleToggleStatus = async (task: any) => {
    setUpdatingTaskId(task.id)
    const isCompleted = task.status === "completed" || task.status === "done"
    const nextStatus = isCompleted ? "todo" : "completed"

    try {
      if (activeTimer && activeTimer.task_id === task.id) {
        await stopTimer()
      }
      await updateTask(task.id, { status: nextStatus })
      await fetchTasks({ projectId })
      toast.success(`Task marked as ${nextStatus}`)
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle task status")
    } finally {
      setUpdatingTaskId(null)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const openAddModule = (parentId: string | null = null) => {
    setEditingModule(null)
    setParentForSub(parentId)
    setForm({ ...defaultForm, parent_id: parentId })
    setIsModuleDialogOpen(true)
  }

  const openEditModule = (mod: ProjectModule) => {
    setEditingModule(mod)
    setParentForSub(mod.parent_id)
    setForm({
      name: mod.name,
      description: mod.description || "",
      color: mod.color,
      parent_id: mod.parent_id,
      assigned_to: (mod as any).assigned_to || null
    })
    setIsModuleDialogOpen(true)
  }

  const handleSaveModule = async () => {
    if (!form.name.trim()) { toast.error("Module name is required"); return }
    setIsSaving(true)
    try {
      const sanitizedAssignedTo = form.assigned_to === "none" || !form.assigned_to ? null : form.assigned_to
      if (editingModule) {
        await updateModule(editingModule.id, {
          name: form.name,
          description: form.description,
          color: form.color,
          assigned_to: sanitizedAssignedTo
        })
        toast.success("Module updated")
      } else {
        await addModule({
          ...form,
          project_id: projectId,
          assigned_to: sanitizedAssignedTo
        })
        toast.success(form.parent_id ? "Sub-module created" : "Module created")
      }
      setIsModuleDialogOpen(false)
      setForm(defaultForm)
    } catch (err: any) {
      toast.error(err.message || "Failed to save module")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDeleteModule = async (id: string) => {
    try {
      await deleteModule(id)
      toast.success("Module deleted")
      if (selectedModuleId === id) setSelectedModuleId(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to delete module")
    }
  }

  const getModuleTasks = (moduleId: string) => projectTasks.filter(t => (t as any).module_id === moduleId)

  const getDueDateBadge = (dueDate: string | null | undefined) => {
    if (!dueDate) return null
    const d = new Date(dueDate)
    if (isPast(d) && !isToday(d)) return <Badge variant="destructive" className="text-[9px] h-4">Overdue</Badge>
    if (isToday(d)) return <Badge className="bg-amber-500 text-[9px] h-4">Due Today</Badge>
    return <span className="text-[10px] text-muted-foreground">{format(d, "MMM d")}</span>
  }

  const selectedModule = projectModules.flatMap(m => [m, ...(m.submodules || [])]).find(m => m.id === selectedModuleId)
  const selectedModuleTasks = selectedModuleId ? getModuleTasks(selectedModuleId) : []

  return (
    <div className="flex gap-4 h-[560px]">
      {/* Left: Module Tree */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Modules
          </h4>
          {canManage && (
            <Button size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={() => openAddModule(null)}>
              <Plus className="h-3 w-3" />
              Module
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {projectModules.length === 0 ? (
            <div className="py-10 text-center border border-dashed rounded-xl">
              <Layers className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                No modules yet
              </p>
              {canManage && (
                <Button size="sm" variant="ghost" className="mt-2 h-7 text-[10px]" onClick={() => openAddModule(null)}>
                  Create First Module
                </Button>
              )}
            </div>
          ) : (
            projectModules.map(mod => {
              const modTasks = getModuleTasks(mod.id)
              const submodTotalTasks = (mod.submodules || []).reduce((acc, s) => acc + getModuleTasks(s.id).length, 0)
              const isExpanded = expandedModules.has(mod.id)
              const isSelected = selectedModuleId === mod.id
              const modMember = members.find(m => m.id === (mod as any).assigned_to)

              return (
                <div key={mod.id}>
                  {/* Top-level module */}
                  <div
                    className={cn(
                      "group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer border transition-all",
                      isSelected
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "hover:bg-muted/50 border-transparent hover:border-border/40"
                    )}
                    onClick={() => { setSelectedModuleId(mod.id); if (mod.submodules?.length) toggleExpand(mod.id) }}
                  >
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: mod.color }} />
                    <span className="text-xs font-bold flex-1 truncate">{mod.name}</span>
                    {modMember && (
                      <Avatar className="h-4.5 w-4.5 mr-1 border border-background shadow-sm flex-shrink-0">
                        <AvatarImage src={(modMember as any).avatar_url} />
                        <AvatarFallback className="text-[7px] font-bold bg-primary/10 text-primary">{modMember.full_name?.charAt(0)}</AvatarFallback>
                      </Avatar>
                    )}
                    <div className="flex items-center gap-1">
                      {(modTasks.length + submodTotalTasks) > 0 && (
                        <span className="text-[9px] font-black text-muted-foreground">{modTasks.length + submodTotalTasks}</span>
                      )}
                      {(mod.submodules?.length || 0) > 0 && (
                        <button onClick={e => { e.stopPropagation(); toggleExpand(mod.id) }} className="text-muted-foreground hover:text-foreground">
                          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        </button>
                      )}
                      {canManage && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={e => { e.stopPropagation(); openEditModule(mod) }} className="p-0.5 hover:text-primary rounded">
                            <Pencil className="h-3 w-3" />
                          </button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button onClick={e => e.stopPropagation()} className="p-0.5 hover:text-rose-500 rounded">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Module?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will delete the module and all its sub-modules. Tasks within it will not be deleted but will lose their module link.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-rose-500 hover:bg-rose-600" onClick={() => handleDeleteModule(mod.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub-modules */}
                  {isExpanded && (mod.submodules || []).map(sub => {
                    const subTasks = getModuleTasks(sub.id)
                    const isSubSelected = selectedModuleId === sub.id
                    const submodMember = members.find(m => m.id === (sub as any).assigned_to)
                    return (
                      <div key={sub.id}
                        className={cn(
                          "group ml-4 flex items-center gap-2 p-2 rounded-lg cursor-pointer border transition-all mt-0.5",
                          isSubSelected
                            ? "bg-primary/10 border-primary/30 text-primary"
                            : "hover:bg-muted/50 border-transparent hover:border-border/30"
                        )}
                        onClick={() => setSelectedModuleId(sub.id)}
                      >
                        <div className="h-2 w-2 rounded-full flex-shrink-0 opacity-70" style={{ backgroundColor: sub.color }} />
                        <span className="text-[11px] font-bold flex-1 truncate">{sub.name}</span>
                        {submodMember && (
                          <Avatar className="h-4 w-4 mr-1 border border-background shadow-sm flex-shrink-0">
                            <AvatarImage src={(submodMember as any).avatar_url} />
                            <AvatarFallback className="text-[7px] font-bold bg-primary/10 text-primary">{submodMember.full_name?.charAt(0)}</AvatarFallback>
                          </Avatar>
                        )}
                        {subTasks.length > 0 && <span className="text-[9px] font-black text-muted-foreground">{subTasks.length}</span>}
                        {canManage && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); openEditModule(sub) }} className="p-0.5 hover:text-primary rounded">
                              <Pencil className="h-2.5 w-2.5" />
                            </button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button onClick={e => e.stopPropagation()} className="p-0.5 hover:text-rose-500 rounded">
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Sub-module?</AlertDialogTitle>
                                  <AlertDialogDescription>Tasks in this sub-module will lose their module link.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction className="bg-rose-500 hover:bg-rose-600" onClick={() => handleDeleteModule(sub.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Add sub-module button */}
                  {canManage && isExpanded && (
                    <button
                      className="ml-4 mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary p-1.5 rounded-lg w-full transition-colors"
                      onClick={() => openAddModule(mod.id)}
                    >
                      <Plus className="h-3 w-3" />
                      Add sub-module
                    </button>
                  )}
                  {canManage && !isExpanded && (
                    <button
                      className="ml-2 mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary p-1.5 rounded-lg w-full transition-colors"
                      onClick={() => openAddModule(mod.id)}
                    >
                      <Plus className="h-3 w-3" />
                      Add sub-module
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px bg-border/50 flex-shrink-0" />

      {/* Right: Tasks panel for selected module */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedModuleId ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
            <FolderOpen className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-bold text-muted-foreground">Select a module to view its tasks</p>
            <p className="text-[11px] text-muted-foreground/60 max-w-[200px]">
              Modules help organize tasks into logical groups within a project.
            </p>
          </div>
        ) : (
          <>
            {/* Module header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: selectedModule?.color }} />
                <h4 className="text-sm font-black">{selectedModule?.name}</h4>
                {selectedModule?.description && (
                  <span className="text-xs text-muted-foreground">— {selectedModule.description}</span>
                )}
                <Badge variant="outline" className="text-[9px]">{selectedModuleTasks.length} tasks</Badge>
              </div>
              {canManage && (
                <Button size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={() => setIsTaskDialogOpen(true)}>
                  <Plus className="h-3 w-3" />
                  Add Task
                </Button>
              )}
            </div>

            {/* Tasks list */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {selectedModuleTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-xl gap-2">
                  <CheckCircle2 className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">No tasks in this module</p>
                  {canManage && (
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] mt-1" onClick={() => setIsTaskDialogOpen(true)}>
                      Create First Task
                    </Button>
                  )}
                </div>
              ) : (
                selectedModuleTasks.map(task => {
                  const member = members.find(m => m.id === task.assigned_to)
                  const isCompleted = task.status === 'completed' || task.status === 'done'
                  const isUpdating = updatingTaskId === task.id
                  const isTimerRunning = activeTimer?.task_id === task.id
                  const taskAny = task as any

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3 rounded-xl border bg-card/40 hover:bg-card hover:border-border/60 transition-all group",
                        isCompleted && "opacity-50",
                        isTimerRunning && "bg-sky-500/5 border-l-2 border-sky-500"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Status Checkbox */}
                        <button
                          onClick={() => handleToggleStatus(task)}
                          disabled={isUpdating}
                          className="text-muted-foreground hover:text-emerald-500 flex-shrink-0 transition-colors"
                        >
                          {isUpdating ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          ) : isCompleted ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Circle className="h-4 w-4" />
                          )}
                        </button>

                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs font-bold truncate", isCompleted && "line-through text-muted-foreground")}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", PRIORITY_COLORS[task.priority || 'medium'])}>
                              {task.priority}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[9px] h-4 px-1.5", STATUS_COLORS[task.status || 'todo'])}>
                              {(task.status || 'todo').replace('_', ' ')}
                            </Badge>
                            
                            {/* Estimated hours indicator */}
                            {task.estimated_hours && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-primary/5 text-primary border-primary/20">
                                {task.estimated_hours}h est
                              </Badge>
                            )}

                            {/* Dependencies blocked indicator */}
                            {taskAny.dependencies && taskAny.dependencies.length > 0 && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-rose-500/10 text-rose-500 border-rose-500/20 flex items-center gap-1">
                                <AlertCircle className="h-2.5 w-2.5" /> Depends on {taskAny.dependencies.length}
                              </Badge>
                            )}

                            {/* Live Timer Badge */}
                            {isTimerRunning && activeTimer && (
                              <span className="flex items-center gap-1 text-[9px] font-bold text-sky-500 bg-sky-500/10 px-1.5 py-0.5 rounded-full animate-pulse border border-sky-500/20">
                                <Timer className="h-2.5 w-2.5" />
                                {getElapsedDuration(activeTimer.start_time)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right Action side: Play/Pause controls, Due date, Assignee */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Play/Pause Timer button */}
                        {!isCompleted && (
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            {isTimerRunning ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-full"
                                onClick={handleStopTaskTimer}
                                title="Pause focus timer"
                              >
                                <Pause className="h-3 w-3 fill-rose-500" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-sky-500 hover:text-sky-600 hover:bg-sky-500/10 rounded-full"
                                onClick={() => handleStartTaskTimer(task)}
                                disabled={activeTimer !== null}
                                title={activeTimer ? "Another timer is running" : "Start focus timer"}
                              >
                                <Play className="h-3 w-3 fill-sky-500" />
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Due date */}
                        <div className="flex-shrink-0 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {getDueDateBadge(task.due_date)}
                        </div>

                        {/* Assignee */}
                        {member && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Avatar className="h-5 w-5">
                              <AvatarImage src={(member as any).avatar_url} />
                              <AvatarFallback className="text-[8px]">{member.full_name?.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-[10px] text-muted-foreground font-medium hidden sm:block">
                              {member.full_name?.split(' ')[0]}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Module Create/Edit Dialog */}
      <Dialog open={isModuleDialogOpen} onOpenChange={setIsModuleDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-widest">
              {editingModule ? "Edit Module" : parentForSub ? "New Sub-Module" : "New Module"}
            </DialogTitle>
            <DialogDescription className="sr-only">Fill in the module details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Module Name *</label>
              <Input
                placeholder={parentForSub ? "e.g. User Authentication, API endpoints..." : "e.g. Frontend, Backend, QA..."}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="bg-muted/20"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</label>
              <textarea
                placeholder="Optional description..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="flex min-h-[60px] w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assign Team Member</label>
              <Select
                value={form.assigned_to || "none"}
                onValueChange={(val) => setForm(f => ({ ...f, assigned_to: val === "none" ? null : val }))}
              >
                <SelectTrigger className="bg-muted/20">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None Assigned</SelectItem>
                  {eligibleModuleMembers.map(member => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Color</label>
              <div className="flex gap-2 flex-wrap">
                {MODULE_COLORS.map(c => (
                  <button
                    key={c.value}
                    className={cn("h-7 w-7 rounded-full transition-all border-2", form.color === c.value ? "border-foreground scale-110" : "border-transparent")}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsModuleDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1 font-black uppercase tracking-wider text-xs" onClick={handleSaveModule} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                {editingModule ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Task to Module Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-widest">
              Add Task — {selectedModule?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This task will be added to the <strong>{selectedModule?.name}</strong> module.
            </DialogDescription>
          </DialogHeader>
          <TaskForm
            task={{ project_id: projectId, module_id: selectedModuleId } as any}
            onSuccess={() => {
              setIsTaskDialogOpen(false)
              fetchTasks({ projectId })
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
