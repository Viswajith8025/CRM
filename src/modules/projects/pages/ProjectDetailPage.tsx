import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, DollarSign, User, CheckCircle2, Circle } from "lucide-react"
import { useProjectsStore } from "../projectsStore"
import { Project, Milestone } from "../types"
import { LoadingState } from "@/components/shared/LoadingState"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getProjectById, fetchMilestones } = useProjectsStore()
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      if (!id) return
      const [projData, mileData] = await Promise.all([
        getProjectById(id),
        fetchMilestones(id)
      ])
      setProject(projData)
      setMilestones(mileData)
      setLoading(false)
    }
    loadData()
  }, [id])

  if (loading) return <LoadingState />
  if (!project) return <div>Project not found</div>

  return (
    <PageWrapper 
      title={project.name} 
      description={project.client?.name}
      className="max-w-6xl mx-auto"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/projects')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <Button>Edit Project</Button>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-lg font-bold mb-4">Project Overview</h3>
            <p className="text-muted-foreground leading-relaxed">
              {project.description || "No description provided for this project."}
            </p>
          </div>

          <Tabs defaultValue="milestones">
            <TabsList>
              <TabsTrigger value="milestones">Milestones</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="team">Team</TabsTrigger>
            </TabsList>
            <TabsContent value="milestones" className="space-y-4 pt-4">
              {milestones.length === 0 ? (
                <div className="text-center py-10 border rounded-lg border-dashed">
                  No milestones defined yet.
                </div>
              ) : (
                milestones.map(m => (
                  <div key={m.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {m.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-xs text-muted-foreground">{m.due_date}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
            {/* Other tabs content */}
          </Tabs>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="rounded-xl border bg-card p-6 space-y-4">
            <h3 className="font-bold">Project Details</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Deadline
                </span>
                <span className="font-medium">{project.end_date || 'N/A'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> Budget
                </span>
                <span className="font-medium">${project.budget?.toLocaleString() || '0'}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  <User className="h-4 w-4" /> Manager
                </span>
                <span className="font-medium">Unassigned</span>
              </div>
            </div>
            <div className="pt-4 space-y-2">
              <div className="flex justify-between text-xs font-medium">
                <span>Overall Progress</span>
                <span>65%</span>
              </div>
              <Progress value={65} className="h-2" />
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  )
}
