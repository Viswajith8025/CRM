import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Plus, LayoutGrid, List, Search, Columns, FileSpreadsheet, Archive } from "lucide-react"
import { ImportWizard } from "@/components/shared/ImportWizard"
import ProjectCard from "../components/ProjectCard"
import { KanbanBoard } from "../components/KanbanBoard"
import { useProjectsStore } from "../projectsStore"
import type { Project } from "../types"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import ProjectForm from "../components/ProjectForm"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import MarketingDashboard from "@/modules/marketing/pages/MarketingDashboard"
import { useAuthStore } from "@/store/useAuthStore"
import { usePermissions } from "@/hooks/usePermissions"

export default function ProjectsPage() {
  const { projects, archivedProjects, fetchProjects, fetchArchivedProjects, subscribeToProjects, isLoading } = useProjectsStore()
  const { profile } = useAuthStore()
  const { hasPermission } = usePermissions()
  const [view, setView] = useState<'grid' | 'list' | 'kanban'>('kanban')
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchArchivedProjects()
    const unsubscribe = subscribeToProjects()
    return () => unsubscribe()
  }, [])

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                         p.client?.name.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || p.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <PageWrapper 
      title="Projects & Growth" 
      description="Manage active projects and monitor your marketing performance."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-primary/20 hover:bg-primary/5" onClick={() => setIsImportOpen(true)}>
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            Bulk Import
          </Button>
          <Button className="gap-2 font-bold" onClick={() => setIsFormOpen(true)}>
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </div>
      }
    >
      <ImportWizard 
        module="projects" 
        open={isImportOpen} 
        onOpenChange={setIsImportOpen} 
        onComplete={() => fetchProjects(true)} 
      />
      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList className="bg-muted/50 border">
          <TabsTrigger value="projects" className="font-bold uppercase tracking-tight text-xs">Active Projects</TabsTrigger>
          <TabsTrigger value="archived" className="font-bold uppercase tracking-tight text-xs text-muted-foreground">Archived</TabsTrigger>
          {hasPermission('projects.manage') && (
            <TabsTrigger value="marketing" className="font-bold uppercase tracking-tight text-xs">Marketing Dashboard</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="projects" className="space-y-6">
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="on_hold">On Hold / Archived</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 bg-muted p-1 rounded-lg">
              <Button 
                variant={view === 'kanban' ? 'secondary' : 'ghost'} 
                size="sm" 
                onClick={() => setView('kanban')}
                className="h-8 w-8 p-0"
              >
                <Columns className="h-4 w-4" />
              </Button>
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
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl bg-card/50">
              <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center mb-4">
                <Plus className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold">No projects found</h3>
              <p className="text-muted-foreground max-w-xs mx-auto">
                {search || statusFilter !== "all" 
                  ? "Try adjusting your filters to find what you're looking for." 
                  : "Get started by creating your first project and assigning it to a client."}
              </p>
            </div>
          ) : view === 'kanban' ? (
            <div className="h-[calc(100vh-280px)] min-h-[600px]">
              <KanbanBoard filterStatus={statusFilter} searchQuery={search} />
            </div>
          ) : (
            <div className={cn(
              view === 'grid' 
                ? "grid gap-6 sm:grid-cols-2 lg:grid-cols-3" 
                : "flex flex-col gap-4"
            )}>
              {filteredProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="space-y-6">
          <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl bg-card/50">
            {archivedProjects.length === 0 ? (
              <>
                <div className="h-20 w-20 rounded-full bg-accent flex items-center justify-center mb-4">
                  <Archive className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold">No archived projects</h3>
                <p className="text-muted-foreground max-w-xs mx-auto">
                  Projects that you archive will appear here.
                </p>
              </>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 w-full text-left px-6">
                {archivedProjects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="marketing">
          <MarketingDashboard isEmbedded={true} />
        </TabsContent>
      </Tabs>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Add a new project to your workspace to start tracking tasks and milestones.
            </DialogDescription>
          </DialogHeader>
          <ProjectForm onSuccess={() => setIsFormOpen(false)} />
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
