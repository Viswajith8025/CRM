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
  LayoutDashboard,
  Box,
  Settings
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Separator } from "@/components/ui/separator"

export default function RolePermissionEditor() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { roles, permissions, fetchRoles, fetchPermissions, updateRole, isLoading } = useRBACStore()
  
  const role = roles.find(r => r.id === id)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])

  useEffect(() => {
    fetchRoles()
    fetchPermissions()
  }, [])

  useEffect(() => {
    if (role?.permissions) {
      // We need IDs for the update, but roles only have codes currently in the store map
      // Let's find IDs based on codes
      const ids = permissions
        .filter(p => role.permissions?.includes(p.code))
        .map(p => p.id)
      setSelectedPerms(ids)
    }
  }, [role, permissions])

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {}
    permissions.forEach(p => {
      if (!groups[p.module]) groups[p.module] = []
      groups[p.module].push(p)
    })
    return groups
  }, [permissions])

  const togglePermission = (id: string) => {
    setSelectedPerms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleSave = async () => {
    if (!role) return
    await updateRole(role.id, { name: role.name }, selectedPerms)
    toast.success("Permissions synchronized successfully")
  }

  if (!role) return null

  return (
    <PageWrapper 
      title={`Configure: ${role.name}`}
      description="Define granular access rights and module visibility for this role. Changes reflect immediately."
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/roles')} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Back to Roles
          </Button>
          <Button onClick={handleSave} className="gap-2 font-bold shadow-xl shadow-primary/20">
            <Save className="h-4 w-4" /> Save Permission Matrix
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Info Panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/50 bg-card/50">
            <CardHeader>
              <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Role Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Current Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-sm font-bold">Active Configuration</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-tighter">Access Scope</p>
                <p className="text-sm font-bold mt-1">{selectedPerms.length} Permissions Granted</p>
              </div>
              <Separator className="bg-border/50" />
              <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                Modifying these permissions will instantly update the Sidebar, Dashboard, and API access for all users assigned to this role.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Permission Matrix */}
        <div className="lg:col-span-3 space-y-6">
          {Object.entries(groupedPermissions).map(([module, perms]) => (
            <Card key={module} className="border-border/50 bg-card/30 overflow-hidden">
              <CardHeader className="bg-muted/30 border-b border-border/50 py-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black tracking-tight uppercase flex items-center gap-2">
                    <Box className="h-4 w-4 text-primary" /> {module} Module
                  </CardTitle>
                  <CardDescription>Grant visibility and action rights for the {module} system.</CardDescription>
                </div>
                <Badge variant="outline" className="text-[10px] font-black uppercase border-primary/20 bg-primary/5 text-primary">
                  {perms.filter(p => selectedPerms.includes(p.id)).length} Active
                </Badge>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border/50">
                  {perms.map((perm) => (
                    <div 
                      key={perm.id} 
                      className="flex items-center justify-between p-4 hover:bg-primary/5 transition-colors group cursor-pointer"
                      onClick={() => togglePermission(perm.id)}
                    >
                      <div className="flex-1">
                        <p className="text-sm font-bold tracking-tight group-hover:text-primary transition-colors">{perm.name}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{perm.description}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity">
                          {perm.code}
                        </span>
                        <Checkbox 
                          checked={selectedPerms.includes(perm.id)} 
                          onCheckedChange={() => togglePermission(perm.id)}
                          className="h-5 w-5 rounded-md border-border/50"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PageWrapper>
  )
}
