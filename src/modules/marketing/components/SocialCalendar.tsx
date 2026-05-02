import { useEffect } from "react"
import { useMarketingStore } from "../marketingStore"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { Plus, MessageCircle, MessageSquare, Briefcase, Camera, Calendar } from "lucide-react"

export function SocialCalendar() {
  const { posts, fetchPosts, isLoading } = useMarketingStore()

  useEffect(() => {
    fetchPosts()
  }, [])

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'facebook': return <MessageCircle className="h-5 w-5 text-blue-600" />
      case 'twitter': return <MessageSquare className="h-5 w-5 text-sky-500" />
      case 'linkedin': return <Briefcase className="h-5 w-5 text-blue-700" />
      case 'instagram': return <Camera className="h-5 w-5 text-pink-600" />
      default: return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" /> Content Calendar
        </h3>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Schedule Post
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center p-8 text-muted-foreground">Loading calendar...</div>
        ) : posts.length === 0 ? (
          <div className="col-span-full text-center p-8 text-muted-foreground border rounded-xl border-dashed">
            No social posts scheduled. Plan your content here.
          </div>
        ) : (
          posts.map(post => (
            <div key={post.id} className="p-4 rounded-xl border bg-card hover:border-primary/50 transition-colors flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-3">
                  {getPlatformIcon(post.platform)}
                  <Badge variant={post.status === 'published' ? 'default' : 'secondary'} className="uppercase text-[10px]">
                    {post.status}
                  </Badge>
                </div>
                <p className="text-sm mb-4 line-clamp-3">{post.content}</p>
                {post.media_url && (
                  <div className="h-24 w-full rounded-md bg-muted/50 border mb-4 flex items-center justify-center text-xs text-muted-foreground">
                    [Media Attached]
                  </div>
                )}
              </div>
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest pt-4 border-t">
                {format(new Date(post.scheduled_for), 'MMM d, yyyy • h:mm a')}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
