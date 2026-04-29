import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, Users, Layout, MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Project } from "../types"
import { useNavigate } from "react-router-dom"
import { format } from "date-fns"

const statusColors: Record<string, string> = {
  planning: "bg-blue-500/10 text-blue-500",
  in_progress: "bg-emerald-500/10 text-emerald-500",
  on_hold: "bg-amber-500/10 text-amber-500",
  completed: "bg-purple-500/10 text-purple-500",
  cancelled: "bg-rose-500/10 text-rose-500",
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()

  return (
    <Card 
      className="group cursor-pointer hover:shadow-lg transition-all duration-200 border-border/50"
      onClick={() => navigate(`/projects/${project.id}`)}
    >
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className={statusColors[project.status]}>
            {project.status.replace('_', ' ')}
          </Badge>
          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
        <CardTitle className="mt-2 text-xl font-bold group-hover:text-primary transition-colors">
          {project.name}
        </CardTitle>
        <CardDescription className="line-clamp-2">
          {project.client?.name || "No Client Assigned"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <span>{project.end_date ? format(new Date(project.end_date), 'MMM d, yyyy') : 'No deadline'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            <span>8/12 Tasks</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium">
            <span>Progress</span>
            <span>65%</span>
          </div>
          <Progress value={65} className="h-1.5" />
        </div>

        <div className="flex items-center -space-x-2 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-7 w-7 rounded-full border-2 border-background bg-accent flex items-center justify-center text-[10px] font-bold">
              U{i}
            </div>
          ))}
          <div className="h-7 w-7 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-medium">
            +2
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
