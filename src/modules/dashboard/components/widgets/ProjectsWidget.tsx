import { CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Briefcase, BarChart3 } from 'lucide-react'
import { useProjectsStore } from '@/modules/projects'
import { useEffect } from 'react'
import { Progress } from '@/components/ui/progress'

export function ProjectsWidget() {
  const { projects, fetchProjects } = useProjectsStore()

  useEffect(() => {
    fetchProjects()
  }, [])

  const activeProjects = projects.filter(p => p.status === 'in_progress').slice(0, 3)

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-purple-500" />
          Active Projects
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {activeProjects.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No active projects.</p>
        ) : (
          activeProjects.map(project => {
            const completed = project.tasks?.filter((t: any) => t.status === 'done').length || 0
            const total = project.tasks?.length || 1
            const progress = Math.round((completed / total) * 100)
            
            return (
              <div key={project.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black truncate">{project.name}</p>
                  <span className="text-[10px] font-bold text-muted-foreground">{progress}%</span>
                </div>
                <Progress value={progress} className="h-1" />
              </div>
            )
          })
        )}
      </CardContent>
    </div>
  )
}
