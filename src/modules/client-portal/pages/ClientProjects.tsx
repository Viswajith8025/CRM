import { useEffect } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useProjectsStore } from "@/modules/projects"
import ProjectCard from "@/modules/projects/components/ProjectCard"

export default function ClientProjects() {
  const { fetchProjects, projects } = useProjectsStore()

  useEffect(() => {
    fetchProjects()
  }, [])

  return (
    <PageWrapper 
      title="My Projects" 
      description="Track the progress of your active engagements."
    >
      {projects.length === 0 ? (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
          No active projects found.
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
