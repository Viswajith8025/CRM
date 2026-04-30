import { useEffect } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Card, CardContent } from "@/components/ui/card"
import { Bell, CheckCircle2, AlertCircle, Info, Trash2, Ghost } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useNotificationsStore } from "../notificationsStore"
import { formatDistanceToNow } from "date-fns"

const iconMap = {
  assignment: Bell,
  billing: CheckCircle2,
  system: AlertCircle,
  project: Info
}

const colorMap = {
  assignment: "text-blue-500 bg-blue-500/10",
  billing: "text-emerald-500 bg-emerald-500/10",
  system: "text-rose-500 bg-rose-500/10",
  project: "text-amber-500 bg-amber-500/10"
}

export default function NotificationsPage() {
  const { 
    notifications, 
    isLoading, 
    fetchNotifications, 
    markAsRead, 
    deleteNotification, 
    clearAll,
    subscribeToNotifications 
  } = useNotificationsStore()

  useEffect(() => {
    fetchNotifications()
    const unsubscribe = subscribeToNotifications()
    return () => unsubscribe()
  }, [])

  const handleMarkRead = (id: string, isRead: boolean) => {
    if (!isRead) markAsRead(id)
  }

  return (
    <PageWrapper 
      title="Notifications" 
      description="Stay updated with the latest workspace activity and alerts."
      actions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2"
            onClick={clearAll}
            disabled={notifications.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">
        {isLoading && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-pulse">
            <Bell className="h-12 w-12 mb-4 opacity-20" />
            <p>Syncing notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border-2 border-dashed rounded-2xl">
            <Ghost className="h-12 w-12 mb-4 opacity-20" />
            <p className="font-bold">No notifications yet</p>
            <p className="text-sm">We'll let you know when something happens.</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = iconMap[notification.type] || Bell
            const colorClass = colorMap[notification.type] || "text-muted-foreground bg-muted"
            
            return (
              <Card 
                key={notification.id} 
                className={cn(
                  "transition-all duration-300 border-border/50 hover:shadow-md cursor-pointer",
                  !notification.is_read && "bg-primary/5 border-primary/20 ring-1 ring-primary/10"
                )}
                onClick={() => handleMarkRead(notification.id, notification.is_read)}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={cn("p-2 rounded-xl shrink-0", colorClass)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={cn("font-bold text-sm truncate", !notification.is_read && "text-primary")}>
                        {notification.title}
                      </h3>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {notification.description}
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider px-1.5 h-4">
                        {notification.type}
                      </Badge>
                      {!notification.is_read && (
                        <Badge className="text-[8px] h-4 bg-primary text-primary-foreground font-black uppercase">New</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-rose-500"
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteNotification(notification.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </PageWrapper>
  )
}

