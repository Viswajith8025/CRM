import { useEffect } from "react"
import { useActivityStore } from "../../modules/admin/activityStore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow, format, isToday, isYesterday, isSameDay } from "date-fns"
import {
  PlusCircle,
  RefreshCcw,
  Trash2,
  CheckCircle2,
  CreditCard,
  LogIn,
  FileText,
  User,
  Send,
  ThumbsUp,
  ThumbsDown,
  UserCheck,
  FolderPlus,
  ClipboardCheck,
  Milestone,
  StickyNote,
  BarChart2,
  Download,
  ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"

interface ActivityTimelineProps {
  /** Filter by a specific entity ID (lead, client, project, etc.) */
  entityId?: string
  /** Also fetch activities from a related entity (e.g., all activities linked to a client via their lead) */
  relatedEntityId?: string
  targetType?: string
  userId?: string
  limit?: number
  className?: string
  /** Whether to show the entity type badge on each event */
  showEntityBadge?: boolean
}

type ActionConfig = {
  icon: JSX.Element
  label: string
  colorClass: string
  dotClass: string
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  CREATE:             { icon: <PlusCircle className="h-3.5 w-3.5" />,    label: "Created",            colorClass: "text-emerald-500", dotClass: "bg-emerald-500/15 border-emerald-500/30" },
  UPDATE:             { icon: <RefreshCcw className="h-3.5 w-3.5" />,    label: "Updated",            colorClass: "text-blue-500",    dotClass: "bg-blue-500/15 border-blue-500/30" },
  DELETE:             { icon: <Trash2 className="h-3.5 w-3.5" />,         label: "Deleted",           colorClass: "text-rose-500",    dotClass: "bg-rose-500/15 border-rose-500/30" },
  STATUS_CHANGE:      { icon: <RefreshCcw className="h-3.5 w-3.5" />,    label: "Status Changed",     colorClass: "text-purple-500",  dotClass: "bg-purple-500/15 border-purple-500/30" },
  PAYMENT:            { icon: <CreditCard className="h-3.5 w-3.5" />,    label: "Payment Received",   colorClass: "text-amber-500",   dotClass: "bg-amber-500/15 border-amber-500/30" },
  PROPOSAL_SENT:      { icon: <Send className="h-3.5 w-3.5" />,           label: "Proposal Sent",     colorClass: "text-indigo-500",  dotClass: "bg-indigo-500/15 border-indigo-500/30" },
  PROPOSAL_APPROVED:  { icon: <ThumbsUp className="h-3.5 w-3.5" />,      label: "Proposal Approved", colorClass: "text-emerald-500", dotClass: "bg-emerald-500/15 border-emerald-500/30" },
  PROPOSAL_REJECTED:  { icon: <ThumbsDown className="h-3.5 w-3.5" />,    label: "Proposal Rejected", colorClass: "text-rose-500",    dotClass: "bg-rose-500/15 border-rose-500/30" },
  CLIENT_ACTIVATED:   { icon: <UserCheck className="h-3.5 w-3.5" />,     label: "Client Activated",  colorClass: "text-emerald-500", dotClass: "bg-emerald-500/15 border-emerald-500/30" },
  INVOICE_GENERATED:  { icon: <FileText className="h-3.5 w-3.5" />,      label: "Invoice Generated", colorClass: "text-cyan-500",    dotClass: "bg-cyan-500/15 border-cyan-500/30" },
  TASK_COMPLETED:     { icon: <ClipboardCheck className="h-3.5 w-3.5" />, label: "Task Completed",   colorClass: "text-teal-500",    dotClass: "bg-teal-500/15 border-teal-500/30" },
  MILESTONE_REACHED:  { icon: <Milestone className="h-3.5 w-3.5" />,     label: "Milestone Reached", colorClass: "text-violet-500",  dotClass: "bg-violet-500/15 border-violet-500/30" },
  NOTE_ADDED:         { icon: <StickyNote className="h-3.5 w-3.5" />,    label: "Note Added",        colorClass: "text-slate-400",   dotClass: "bg-slate-500/15 border-slate-500/30" },
  LOGIN:              { icon: <LogIn className="h-3.5 w-3.5" />,          label: "Login",             colorClass: "text-slate-400",   dotClass: "bg-slate-500/15 border-slate-500/30" },
  EXPORT:             { icon: <Download className="h-3.5 w-3.5" />,       label: "Exported",          colorClass: "text-slate-400",   dotClass: "bg-slate-500/15 border-slate-500/30" },
}

const ENTITY_BADGE_COLORS: Record<string, string> = {
  lead:     "bg-blue-500/10 text-blue-500 border-blue-500/20",
  client:   "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  project:  "bg-violet-500/10 text-violet-500 border-violet-500/20",
  task:     "bg-teal-500/10 text-teal-500 border-teal-500/20",
  invoice:  "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  payment:  "bg-amber-500/10 text-amber-500 border-amber-500/20",
  proposal: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
  document: "bg-slate-500/10 text-slate-400 border-slate-500/20",
}

function getDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMMM d, yyyy")
}

function groupByDate(activities: ReturnType<typeof useActivityStore.getState>["activities"]) {
  const groups: { label: string; items: typeof activities }[] = []
  let currentLabel = ""

  for (const activity of activities) {
    const label = getDateLabel(activity.created_at)
    if (label !== currentLabel) {
      currentLabel = label
      groups.push({ label, items: [] })
    }
    groups[groups.length - 1].items.push(activity)
  }
  return groups
}

export function ActivityTimeline({
  entityId,
  relatedEntityId,
  targetType,
  userId,
  limit = 20,
  className,
  showEntityBadge = true,
}: ActivityTimelineProps) {
  const { activities, fetchActivities, isLoading } = useActivityStore()

  useEffect(() => {
    fetchActivities({
      targetId: entityId,
      relatedEntityId,
      targetType,
      userId,
      limit,
    })
  }, [entityId, relatedEntityId, targetType, userId, limit])

  if (isLoading && (!activities || activities.length === 0)) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 items-start">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center">
          <BarChart2 className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No activity recorded yet.</p>
        <p className="text-xs text-muted-foreground/60">Events will appear here as actions are taken.</p>
      </div>
    )
  }

  const grouped = groupByDate(activities)

  return (
    <div className={cn("space-y-6", className)}>
      {grouped.map((group) => (
        <div key={group.label} className="space-y-1">
          {/* Date separator */}
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-border/60" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 shrink-0">
              {group.label}
            </span>
            <div className="h-px flex-1 bg-border/60" />
          </div>

          {/* Timeline items */}
          <div className="relative space-y-4 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-border/60">
            {group.items.map((activity) => {
              const config = ACTION_CONFIG[activity.action] ?? {
                icon: <FileText className="h-3.5 w-3.5" />,
                label: activity.action,
                colorClass: "text-muted-foreground",
                dotClass: "bg-muted border-muted-foreground/20",
              }

              return (
                <div key={activity.id} className="relative flex gap-4 items-start pl-1">
                  {/* Dot */}
                  <div
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                      config.dotClass,
                      config.colorClass
                    )}
                  >
                    {config.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <span className="text-sm font-bold text-foreground">
                          {activity.profiles?.full_name || "System"}
                        </span>
                        <span className={cn("text-sm font-medium", config.colorClass)}>
                          {config.label}
                        </span>
                        {activity.target_name && (
                          <span className="text-sm text-foreground font-semibold truncate max-w-[180px]">
                            "{activity.target_name}"
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {showEntityBadge && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] font-black uppercase tracking-wider px-1.5 py-0",
                              ENTITY_BADGE_COLORS[activity.target_type] ?? "bg-muted text-muted-foreground"
                            )}
                          >
                            {activity.target_type}
                          </Badge>
                        )}
                        <Avatar className="h-5 w-5 border shrink-0">
                          <AvatarImage src={activity.profiles?.avatar_url} />
                          <AvatarFallback className="text-[8px]">
                            <User className="h-2.5 w-2.5" />
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>

                    {/* Description */}
                    {activity.metadata?.description && (
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {activity.metadata.description}
                      </p>
                    )}

                    {/* Version History / Restore UI */}
                    {activity.metadata?.previous_value !== undefined && activity.metadata?.new_value !== undefined && (
                      <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40 text-[10px] font-bold">
                        <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 line-through border border-rose-500/10">
                          {typeof activity.metadata.previous_value === 'number' ? `₹${activity.metadata.previous_value.toLocaleString()}` : String(activity.metadata.previous_value)}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground opacity-30" />
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {typeof activity.metadata.new_value === 'number' ? `₹${activity.metadata.new_value.toLocaleString()}` : String(activity.metadata.new_value)}
                        </span>
                      </div>
                    )}

                    <span className="mt-1.5 inline-block text-[10px] text-muted-foreground/60 font-medium">
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
