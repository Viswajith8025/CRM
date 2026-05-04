import { CardHeader, CardContent } from '@/components/ui/card'
import { Clock } from 'lucide-react'
import { useActivityStore } from '@/modules/reports/activityStore'
import { useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'

export function ActivityWidget() {
  const { activities, fetchActivities } = useActivityStore()

  useEffect(() => {
    fetchActivities()
  }, [])

  const recent = activities.slice(0, 5)

  return (
    <div className="h-full flex flex-col bg-slate-950/30 rounded-xl border border-white/5 backdrop-blur-sm">
      <CardHeader className="pb-4 pt-6 px-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-[0.2em] text-white/60">Workspace Activity</h3>
          <Button variant="link" className="text-[10px] font-black uppercase tracking-widest p-0 h-auto text-white/30 hover:text-white">Full Reports</Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-6 pb-6">
        <div className="space-y-6">
          {recent.length === 0 ? (
            <p className="text-xs text-white/20 py-10 text-center uppercase tracking-widest font-black">Quiet day in the workspace</p>
          ) : (
            recent.map(activity => (
              <div key={activity.id} className="flex items-start gap-4 group">
                <div className="mt-1 h-8 w-8 shrink-0 flex items-center justify-center rounded-full border border-white/10 bg-white/5 group-hover:border-primary/50 group-hover:bg-primary/5 transition-colors">
                   <Clock className="h-3.5 w-3.5 text-white/40 group-hover:text-primary transition-colors" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-white/80 leading-snug">
                    <span className="font-black text-white">{activity.user?.full_name || 'System'}</span>
                    {' '}{activity.action}{' '}
                    <span className="text-primary font-bold">{activity.target_name}</span>
                  </p>
                  <p className="text-[10px] text-white/30 font-bold uppercase tracking-tight mt-1">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </div>
  )
}
