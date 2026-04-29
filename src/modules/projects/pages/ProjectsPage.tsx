import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Plus, LayoutGrid, List, Search } from "lucide-react"
import { ProjectCard } from "../components/ProjectCard"
import { useProjectsStore } from "../projectsStore"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function ProjectsPage() {
  const { projects, fetchProjects, isLoading } = useProjectsStore()
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetchProjects()
  }, [])

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.client?.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <PageWrapper 
      title="Projects" 
      description="Manage and track all your active client projects."
      actions={
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      }
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div className="flex flex-1 items-center gap-4 max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search projects..." 
              className="pl-9" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="planning">Planning</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
          <Button 
            variant={view === 'grid' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setView('grid')}
            className="h-8 w-8 p-0"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button 
            variant={view === 'list' ? 'secondary' : 'ghost'} 
            size="sm" 
            onClick={() => setView('list')}
            className="h-8 w-8 p-0"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[250px] rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center mb-4">
            <Plus className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-bold">No projects found</h3>
          <p className="text-muted-foreground max-w-xs mx-auto">
            Get started by creating your first project and assigning it to a client.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </PageWrapper>
  )
}
