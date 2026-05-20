import { useEffect, useState } from 'react'
import { Layers, FolderOpen, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/useAuthStore'
import { supabase } from '@/lib/supabase'
import { parseModuleMetadata } from '@/lib/metadataFallback'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface AssignedModule {
  id: string
  name: string
  color: string
  description: string | null
  parent_id: string | null
  project_id: string
  project_name: string
  is_submodule: boolean
}

export function MyAssignedModulesWidget() {
  const { profile } = useAuthStore()
  const navigate = useNavigate()
  const [modules, setModules] = useState<AssignedModule[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!profile?.id || !profile?.organization_id) return

    const fetchAssignedModules = async () => {
      try {
        setIsLoading(true)
        // Fetch all modules for this org with their project name
        const { data, error } = await supabase
          .from('project_modules')
          .select('*, projects(id, name)')
          .eq('organization_id', profile.organization_id)

        if (error) throw error

        const all = ((data || []) as any[]).map(m => {
          const metadata = parseModuleMetadata(m)
          return {
            ...m,
            assigned_to: metadata.assigned_to,
            description: metadata.cleanDescription,
            project_name: m.projects?.name || 'Unknown Project',
          }
        })

        // Filter only those assigned to this user
        const mine = all.filter(m => m.assigned_to === profile.id)

        setModules(mine.map(m => ({
          id: m.id,
          name: m.name,
          color: m.color || '#6366f1',
          description: m.description || null,
          parent_id: m.parent_id || null,
          project_id: m.project_id,
          project_name: m.project_name,
          is_submodule: !!m.parent_id,
        })))
      } catch (err) {
        console.error('Failed to fetch assigned modules:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchAssignedModules()
  }, [profile?.id, profile?.organization_id])

  return (
    <div className="bg-card rounded-2xl border border-border/40 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <Layers className="h-4 w-4 text-violet-500" />
          </div>
          <div>
            <p className="text-[11px] font-black uppercase tracking-widest text-violet-500">
              My Assigned Modules
            </p>
            <p className="text-[10px] text-muted-foreground font-medium">
              {isLoading ? '...' : `${modules.length} module${modules.length !== 1 ? 's' : ''} across projects`}
            </p>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-2 max-h-[320px] overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : modules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <FolderOpen className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              No modules assigned yet
            </p>
            <p className="text-[10px] text-muted-foreground/60 max-w-[180px]">
              Modules will appear here when a team lead assigns them to you.
            </p>
          </div>
        ) : (
          modules.map(mod => (
            <button
              key={mod.id}
              onClick={() => navigate(`/projects/${mod.project_id}`)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border border-border/40 bg-card/50",
                "hover:bg-muted/50 hover:border-border/70 transition-all group text-left"
              )}
            >
              {/* Color dot */}
              <div
                className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm"
                style={{ backgroundColor: `${mod.color}18`, border: `2px solid ${mod.color}40` }}
              >
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: mod.color }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold truncate">{mod.name}</p>
                  {mod.is_submodule && (
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 border-violet-500/30 text-violet-500 bg-violet-500/5 flex-shrink-0">
                      Sub
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <FolderOpen className="h-2.5 w-2.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[10px] text-muted-foreground font-medium truncate">
                    {mod.project_name}
                  </span>
                </div>
                {mod.description && (
                  <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">
                    {mod.description}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0 transition-colors" />
            </button>
          ))
        )}
      </div>
    </div>
  )
}
