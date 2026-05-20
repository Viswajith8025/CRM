import { useEffect, useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useRBACStore, type Permission } from "@/modules/admin/rbacStore"
import {
  ShieldCheck,
  Save,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  Box,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export default function RolePermissionEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    roles,
    permissions,
    fetchRoles,
    fetchPermissions,
    updateRole,
    isLoading,
  } = useRBACStore()

  const role = roles.find(r => r.id === id)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // Ensure data is loaded (store guards against duplicate fetches)
  useEffect(() => {
    fetchRoles()
    fetchPermissions()
  }, [])

  // Populate checkboxes once we have both the role and the permissions catalogue
  useEffect(() => {
    if (!role || permissions.length === 0) return
    // role.permissions contains *codes*; map them to permission IDs
    const ids = permissions
      .filter(p => role.permissions?.includes(p.code))
      .map(p => p.id)
    setSelectedPerms(ids)
  }, [role?.id, permissions.length])

  // Group permissions by type and module
  const { modulePermissions, actionPermissions } = useMemo(() => {
    const modules: Permission[] = []
    const actions: Record<string, Permission[]> = {}
    
    permissions.forEach(p => {
      // In the new schema, type is 'module' or 'action'
      // If the database column isn't migrated yet, we fallback to code prefix logic
      const isModule = (p as any).type === 'module' || p.code.startsWith('module.')
      
      if (isModule) {
        modules.push(p)
      } else {
        if (!actions[p.module]) actions[p.module] = []
        actions[p.module].push(p)
      }
    })
    return { modulePermissions: modules, actionPermissions: actions }
  }, [permissions])

  const togglePermission = (permId: string) =>
    setSelectedPerms(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    )

  const toggleModuleActions = (modulePerms: Permission[], select: boolean) => {
    const ids = modulePerms.map(p => p.id)
    setSelectedPerms(prev =>
      select
        ? [...new Set([...prev, ...ids])]
        : prev.filter(id => !ids.includes(id))
    )
  }

  const handleSave = async () => {
    if (!role) return
    setIsSaving(true)
    try {
      await updateRole(role.id, {}, selectedPerms)
    } finally {
      setIsSaving(false)
    }
  }

  // Preview what the user will see in their sidebar
  const visibleModules = useMemo(() => {
    return modulePermissions
      .filter(p => selectedPerms.includes(p.id))
      .map(p => p.name.replace(' Module', '').replace(' Access', ''))
  }, [modulePermissions, selectedPerms])

  if (isLoading) {
    return (
      <PageWrapper title="Loading..." description="Fetching role data...">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      </PageWrapper>
    )
  }

  if (!role) {
    return (
      <PageWrapper title="Role Not Found" description="">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <ShieldCheck className="h-12 w-12 opacity-20" />
          <p className="font-bold text-muted-foreground">This role does not exist or was deleted.</p>
          <Button onClick={() => navigate("/roles")} variant="outline" className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back to Roles
          </Button>
        </div>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper
      title={`Configure Role: ${role.name}`}
      description="Define granular access rights and module visibility. Changes reflect instantly for all assigned users."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/roles")} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back to Roles
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 font-bold shadow-xl shadow-primary/20"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Configuration
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* ── Sidebar: Info & Preview ─────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/50 bg-card/50 sticky top-24">
            <CardHeader>
              <CardTitle className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Workspace Preview
              </CardTitle>
              <CardDescription className="text-[10px]">What users with this role will see</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 rounded-xl bg-background/50 border border-border/40 space-y-3">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Visible Modules</p>
                {visibleModules.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {visibleModules.map(m => (
                      <Badge key={m} variant="secondary" className="text-[9px] font-black uppercase bg-primary/10 text-primary border-primary/20">
                        {m}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-rose-500 font-bold italic">No modules visible. Workspace will be empty!</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-[10px] font-black uppercase">
                  <span className="text-muted-foreground">Total Permissions</span>
                  <span>{selectedPerms.length} / {permissions.length}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-500" 
                    style={{ width: `${(selectedPerms.length / (permissions.length || 1)) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-[10px] font-black uppercase h-9"
                  onClick={() => setSelectedPerms(permissions.map(p => p.id))}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-emerald-500" /> Select All Access
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-[10px] font-black uppercase h-9 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                  onClick={() => setSelectedPerms([])}
                >
                  <XCircle className="h-3.5 w-3.5 mr-2" /> Revoke All Access
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Main Panel: Permissions Matrix ──────────────────────────── */}
        <div className="lg:col-span-3 space-y-10">
          
          {/* Section 1: Module Access */}
          <section className="space-y-4">
            <div className="flex items-center gap-3 px-2">
              <div className="h-8 w-1 bg-primary rounded-full" />
              <h3 className="text-sm font-black uppercase tracking-widest">1. Module Access (Sidebar Visibility)</h3>
            </div>
            <Card className="border-border/50 bg-card/30">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {modulePermissions.map(perm => (
                    <div 
                      key={perm.id} 
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer",
                        selectedPerms.includes(perm.id) 
                          ? "bg-primary/5 border-primary/30 shadow-inner" 
                          : "bg-background/20 border-border/40 hover:border-primary/20"
                      )}
                      onClick={() => togglePermission(perm.id)}
                    >
                      <Checkbox 
                        checked={selectedPerms.includes(perm.id)}
                        onCheckedChange={() => togglePermission(perm.id)}
                        onClick={e => e.stopPropagation()}
                        className="h-5 w-5"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-black uppercase tracking-tight">{perm.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{perm.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 2: Granular Actions */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <div className="h-8 w-1 bg-amber-500 rounded-full" />
              <h3 className="text-sm font-black uppercase tracking-widest">2. Granular Actions (Feature Rights)</h3>
            </div>
            
            {Object.entries(actionPermissions).map(([module, perms]) => {
              const allSelected = perms.every(p => selectedPerms.includes(p.id))
              const someSelected = perms.some(p => selectedPerms.includes(p.id))
              const activeCount = perms.filter(p => selectedPerms.includes(p.id)).length

              return (
                <Card key={module} className="border-border/50 bg-card/20 overflow-hidden">
                  <CardHeader className="bg-muted/20 border-b border-border/40 py-3 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Checkbox
                        checked={allSelected}
                        data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                        onCheckedChange={checked => toggleModuleActions(perms, !!checked)}
                        className="h-4 w-4"
                      />
                      <div>
                        <CardTitle className="text-xs font-black uppercase tracking-widest">{module} Actions</CardTitle>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-black bg-background/50">
                      {activeCount} / {perms.length} ENABLED
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-x divide-y divide-border/30">
                      {perms.map(perm => (
                        <div
                          key={perm.id}
                          className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors group cursor-pointer"
                          onClick={() => togglePermission(perm.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold group-hover:text-primary transition-colors">
                              {perm.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {perm.description}
                            </p>
                          </div>
                          <Checkbox
                            checked={selectedPerms.includes(perm.id)}
                            onCheckedChange={() => togglePermission(perm.id)}
                            onClick={e => e.stopPropagation()}
                            className="h-4 w-4"
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </section>
        </div>
      </div>
    </PageWrapper>
  )
}
