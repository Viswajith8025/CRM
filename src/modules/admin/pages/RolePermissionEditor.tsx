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

  // Group permissions by module
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {}
    permissions.forEach(p => {
      if (!groups[p.module]) groups[p.module] = []
      groups[p.module].push(p)
    })
    return groups
  }, [permissions])

  const togglePermission = (permId: string) =>
    setSelectedPerms(prev =>
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    )

  const toggleModule = (modulePerms: Permission[], select: boolean) => {
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
    await updateRole(role.id, {}, selectedPerms)
    setIsSaving(false)
  }

  // ─── Edge cases ────────────────────────────────────────────
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
      title={`Configure: ${role.name}`}
      description="Define granular access rights and module visibility for this role. Changes are saved immediately."
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
            Save Permissions
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* ── Sidebar info panel ─────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Role Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bulk actions */}
              <div className="flex flex-col gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-[10px] font-black uppercase"
                  onClick={() => setSelectedPerms(permissions.map(p => p.id))}
                >
                  <CheckCircle2 className="h-3 w-3 mr-2" /> Select All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-[10px] font-black uppercase text-rose-500 hover:text-rose-600"
                  onClick={() => setSelectedPerms([])}
                >
                  <XCircle className="h-3 w-3 mr-2" /> Clear All
                </Button>
              </div>

              <Separator className="bg-border/50" />

              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">
                  Active Permissions
                </p>
                <p className="text-2xl font-black mt-1">{selectedPerms.length}</p>
                <p className="text-[10px] text-muted-foreground">of {permissions.length} total</p>
              </div>

              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">
                  Role Type
                </p>
                <Badge
                  variant={role.is_system ? "secondary" : "outline"}
                  className="mt-1 text-[9px] uppercase font-black"
                >
                  {role.is_system ? "System Role" : "Custom Role"}
                </Badge>
              </div>

              <Separator className="bg-border/50" />

              <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                Saving updates the access rights for all users assigned to this role immediately.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Permission matrix ──────────────────────────── */}
        <div className="lg:col-span-3 space-y-6">
          {permissions.length === 0 && (
            <div className="flex items-center justify-center min-h-[200px] text-muted-foreground">
              <p className="text-sm">No permissions configured yet.</p>
            </div>
          )}

          {Object.entries(groupedPermissions).map(([module, perms]) => {
            const allSelected  = perms.every(p => selectedPerms.includes(p.id))
            const someSelected = perms.some(p  => selectedPerms.includes(p.id))
            const activeCount  = perms.filter(p => selectedPerms.includes(p.id)).length

            return (
              <Card key={module} className="border-border/50 bg-card/30 overflow-hidden">
                <CardHeader className="bg-muted/30 border-b border-border/50 py-4 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Checkbox
                      checked={allSelected}
                      // "indeterminate" styling when only some are selected
                      data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                      onCheckedChange={checked => toggleModule(perms, !!checked)}
                      className="h-5 w-5 rounded-md border-primary/50"
                    />
                    <div>
                      <CardTitle className="text-base font-black tracking-tight uppercase flex items-center gap-2">
                        <Box className="h-4 w-4 text-primary" />
                        {module}
                      </CardTitle>
                      <CardDescription className="text-[11px]">
                        {perms.length} permission{perms.length !== 1 ? "s" : ""} in this module
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-black uppercase border-primary/20 bg-primary/5 text-primary shrink-0"
                  >
                    {activeCount} / {perms.length} Active
                  </Badge>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="divide-y divide-border/50">
                    {perms.map(perm => (
                      <div
                        key={perm.id}
                        className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors group cursor-pointer"
                        onClick={() => togglePermission(perm.id)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold tracking-tight group-hover:text-primary transition-colors">
                            {perm.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {perm.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 ml-4 shrink-0">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity">
                            {perm.code}
                          </span>
                          <Checkbox
                            checked={selectedPerms.includes(perm.id)}
                            onCheckedChange={() => togglePermission(perm.id)}
                            onClick={e => e.stopPropagation()}
                            className="h-5 w-5 rounded-md border-border/50"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </PageWrapper>
  )
}
