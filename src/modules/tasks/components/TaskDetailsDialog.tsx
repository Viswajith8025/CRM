import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { format } from "date-fns"
import { Send, Paperclip, CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react"
import { useTasksStore } from "../tasksStore"
import { useAuthStore } from "@/store/useAuthStore"
import type { Task, Subtask } from "../types"
import { cn } from "@/lib/utils"
import { FileUploadZone } from "@/modules/documents/components/FileUploadZone"
import { AttachmentList } from "@/modules/documents/components/AttachmentList"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CommentSection } from "@/components/shared/comments/CommentSection"

interface TaskDetailsDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function TaskDetailsDialog({ task, open, onOpenChange }: TaskDetailsDialogProps) {
  const { subtasks, comments, fetchSubtasks, addSubtask, updateSubtask, fetchComments, addComment, updateTask } = useTasksStore()
  const { profile } = useAuthStore()
  
  const [newSubtask, setNewSubtask] = useState("")
  const [newComment, setNewComment] = useState("")
  const [activeTab, setActiveTab] = useState("content")

  const taskSubtasks = task ? subtasks[task.id] || [] : []
  const taskComments = task ? comments[task.id] || [] : []

  useEffect(() => {
    if (open && task) {
      fetchSubtasks(task.id)
      fetchComments(task.id)
    }
  }, [open, task])

  if (!task) return null

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSubtask.trim()) return
    await addSubtask({ task_id: task.id, title: newSubtask })
    setNewSubtask("")
  }

  const handleToggleSubtask = async (subtask: Subtask) => {
    await updateSubtask(subtask.id, { is_completed: !subtask.is_completed })
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return
    await addComment({
      task_id: task.id,
      user_id: profile?.id,
      content: newComment,
      attachment_url: null
    })
    setNewComment("")
  }

  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
  const progress = taskSubtasks.length > 0 
    ? Math.round((taskSubtasks.filter(s => s.is_completed).length / taskSubtasks.length) * 100)
    : (task.status === 'done' ? 100 : 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="sr-only">
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>
            Detailed view of task: {task.title}
          </DialogDescription>
        </DialogHeader>

        {/* Custom UI Header (Visual only) */}
        <div className="p-6 border-b bg-card">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] uppercase font-bold">{task.project?.name || 'No Project'}</Badge>
                {isOverdue && (
                  <Badge variant="destructive" className="text-[10px] uppercase font-bold gap-1 flex items-center">
                    <AlertCircle className="h-3 w-3" /> Overdue
                  </Badge>
                )}
              </div>
              <h2 className="text-2xl font-black">{task.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="capitalize">{task.status.replace('_', ' ')}</Badge>
              <Badge variant="secondary" className="capitalize">{task.priority}</Badge>
            </div>
          </div>
          <p className="text-muted-foreground text-sm">{task.description || "No description provided."}</p>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Area (Checklists & Details) */}
          <ScrollArea className="flex-1 p-6 border-r bg-muted/10">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="content" className="font-bold uppercase tracking-widest text-[10px]">Details & Checklist</TabsTrigger>
                <TabsTrigger value="attachments" className="font-bold uppercase tracking-widest text-[10px] gap-2">
                  <Paperclip className="h-3 w-3" /> Attachments
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content" className="space-y-8 mt-0">
                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Task Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {/* Subtasks */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Checklist
                  </h4>
                  
                  <div className="space-y-2">
                    {taskSubtasks.map(subtask => (
                      <div 
                        key={subtask.id} 
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border bg-card transition-all cursor-pointer hover:border-primary/50",
                          subtask.is_completed && "opacity-60 bg-muted/50"
                        )}
                        onClick={() => handleToggleSubtask(subtask)}
                      >
                        <Checkbox checked={subtask.is_completed} className={cn(subtask.is_completed && "data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500")} />
                        <span className={cn("text-sm font-medium", subtask.is_completed && "line-through text-muted-foreground")}>
                          {subtask.title}
                        </span>
                      </div>
                    ))}
                    
                    <form onSubmit={handleAddSubtask} className="flex gap-2 mt-4">
                      <Input 
                        placeholder="Add a new subtask..." 
                        value={newSubtask}
                        onChange={e => setNewSubtask(e.target.value)}
                        className="bg-card"
                      />
                      <Button type="submit" variant="secondary">Add</Button>
                    </form>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="space-y-6 mt-0">
                <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Upload Files</h4>
                  <FileUploadZone 
                    relatedId={task.id}
                    relatedType="task"
                    bucket="task-attachments"
                  />
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Files</h4>
                  <AttachmentList 
                    relatedId={task.id}
                    relatedType="task"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </ScrollArea>

          {/* Sidebar (Comments & Metadata) */}
          <div className="w-[350px] flex flex-col bg-card">
            <div className="p-4 border-b space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Assignee</span>
                {task.assignee ? (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{task.assignee.full_name}</span>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={task.assignee.avatar_url} />
                      <AvatarFallback>{task.assignee.full_name.charAt(0)}</AvatarFallback>
                    </Avatar>
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Unassigned</span>
                )}
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Due Date
                </span>
                <span className={cn("font-medium", isOverdue && "text-destructive font-bold")}>
                  {task.due_date ? format(new Date(task.due_date), 'MMM d, yyyy') : 'No Date'}
                </span>
              </div>
            </div>

            {/* Comments Area */}
            <div className="flex-1 flex flex-col min-h-0 border-l">
              <CommentSection entityId={task.id} entityType="task" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
