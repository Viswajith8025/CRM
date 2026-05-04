import { useEffect } from "react"
import { useActivityStore } from "../../modules/admin/activityStore"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { formatDistanceToNow } from "date-fns"
import { 
  PlusCircle, 
  RefreshCcw, 
  Trash2, 
  CheckCircle2, 
  CreditCard, 
  LogIn, 
  FileText,
  User
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface ActivityTimelineProps {
  userId?: string
  targetType?: string
  targetId?: string
  limit?: number
  className?: string
}

const getActionIcon = (action: string) => {
  switch (action) {
    case 'CREATE': return <PlusCircle className="h-4 w-4 text-emerald-500" />
    case 'UPDATE': return <RefreshCcw className="h-4 w-4 text-blue-500" />
    case 'DELETE': return <Trash2 className="h-4 w-4 text-rose-500" />
    case 'STATUS_CHANGE': return <CheckCircle2 className="h-4 w-4 text-purple-500" />
    case 'PAYMENT': return <CreditCard className="h-4 w-4 text-amber-500" />
    case 'LOGIN': return <LogIn className="h-4 w-4 text-slate-500" />
    default: return <FileText className="h-4 w-4 text-muted-foreground" />
  }
}

export function ActivityTimeline({ userId, targetType, targetId, limit = 10, className }: ActivityTimelineProps) {
  const { activities, fetchActivities, isLoading } = useActivityStore()

  useEffect(() => {
    fetchActivities({ userId, targetType, targetId, limit })
  }, [userId, targetType, targetId, limit])

  if (isLoading && activities.length === 0) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground italic">
        No recent activity recorded.
      </div>
    )
  }

  return (
    <div className={cn("space-y-6 relative before:absolute before:inset-y-0 before:left-4 before:w-px before:bg-border", className)}>
      {activities.map((activity, idx) => (
        <div key={activity.id} className="relative flex gap-4 items-start group">
          <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background border ring-4 ring-background">
            {getActionIcon(activity.action)}
          </div>
          
          <div className="flex-1 min-w-0 pt-0.5">
            <div className="text-sm">
              <span className="font-bold text-foreground">
                {activity.profiles?.full_name || 'System'}
              </span>
              <span className="text-muted-foreground mx-1">
                {activity.action.toLowerCase().replace('_', ' ')}
              </span>
              <span className="font-medium text-primary">
                {activity.target_name}
              </span>
            </div>
            
            <p className="mt-0.5 text-xs text-muted-foreground">
              {activity.metadata?.description || `Modified ${activity.target_type}`}
            </p>
            
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
              </span>
              <span className="text-[10px] text-muted-foreground/30">•</span>
              <span className="text-[10px] text-muted-foreground lowercase bg-muted px-1.5 py-0.5 rounded">
                {activity.target_type}
              </span>
            </div>
          </div>

          <Avatar className="h-6 w-6 border">
            <AvatarImage src={activity.profiles?.avatar_url} />
            <AvatarFallback><User className="h-3 w-3" /></AvatarFallback>
          </Avatar>
        </div>
      ))}
    </div>
  )
}
