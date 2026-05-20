import { CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Briefcase } from 'lucide-react'
import { useDashboardDataStore } from '@/modules/dashboard'
import { useEffect } from 'react'
import { Progress } from '@/components/ui/progress'

export function ProjectsWidget() {
  const { projectHealth, fetchProjectHealth } = useDashboardDataStore()

  useEffect(() => {
    fetchProjectHealth()
  }, [])

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-purple-500" />
          Active Projects
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {projectHealth.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center uppercase tracking-widest font-black">No active projects</p>
        ) : (
          projectHealth.map(project => (
            <div key={project.id} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-black truncate">{project.name}</p>
                <span className="text-[10px] font-bold text-muted-foreground">{project.progress}%</span>
              </div>
              <Progress value={project.progress} className="h-1" />
              <div className="flex justify-between text-[8px] text-muted-foreground uppercase font-bold">
                <span>{project.completed_tasks} / {project.total_tasks} Tasks</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </div>
  )
}
