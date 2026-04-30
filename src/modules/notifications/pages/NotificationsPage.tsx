import { PageWrapper } from "@/components/shared/PageWrapper"
import { Card, CardContent } from "@/components/ui/card"
import { Bell, CheckCircle2, AlertCircle, Info, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const notifications = [
  {
    id: 1,
    title: "New Task Assigned",
    description: "You have been assigned to 'Frontend Optimization' for Project Alpha.",
    time: "2 minutes ago",
    type: "assignment",
    read: false,
    icon: Bell,
    color: "text-blue-500 bg-blue-500/10"
  },
  {
    id: 2,
    title: "Invoice Paid",
    description: "Invoice #INV-9284 for $1,200 has been marked as paid by Client X.",
    time: "1 hour ago",
    type: "billing",
    read: false,
    icon: CheckCircle2,
    color: "text-emerald-500 bg-emerald-500/10"
  },
  {
    id: 3,
    title: "System Alert",
    description: "Database maintenance scheduled for 2:00 AM UTC tomorrow.",
    time: "3 hours ago",
    type: "system",
    read: true,
    icon: AlertCircle,
    color: "text-rose-500 bg-rose-500/10"
  },
  {
    id: 4,
    title: "Project Milestone Reached",
    description: "Milestone 'UI Design' for Project Beta has been completed.",
    time: "5 hours ago",
    type: "project",
    read: true,
    icon: Info,
    color: "text-amber-500 bg-amber-500/10"
  }
]

export default function NotificationsPage() {
  return (
    <PageWrapper 
      title="Notifications" 
      description="Stay updated with the latest workspace activity and alerts."
      actions={
        <Button variant="outline" size="sm" className="gap-2">
          <Trash2 className="h-4 w-4" />
          Clear All
        </Button>
      }
    >
      <div className="max-w-4xl mx-auto space-y-4">
        {notifications.map((notification) => (
          <Card key={notification.id} className={cn(
            "transition-all duration-300 border-border/50 hover:shadow-md",
            !notification.read && "bg-primary/5 border-primary/20"
          )}>
            <CardContent className="p-4 flex items-start gap-4">
              <div className={cn("p-2 rounded-xl shrink-0", notification.color)}>
                <notification.icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-sm truncate">{notification.title}</h3>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">{notification.time}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {notification.description}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider px-1.5 h-4">
                    {notification.type}
                  </Badge>
                  {!notification.read && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageWrapper>
  )
}
