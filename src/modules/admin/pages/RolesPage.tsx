import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useRBACStore, type Role } from "@/modules/admin/rbacStore"
import { 
  ShieldCheck, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Users, 
  Trash2, 
  Edit3,
  ShieldAlert,
  ArrowRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useNavigate } from "react-router-dom"
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export default function RolesPage() {
  const { roles, fetchRoles, isLoading, deleteRole, createRole } = useRBACStore()
  const [search, setSearch] = useState("")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newRole, setNewRole] = useState({ name: "", description: "" })
  const navigate = useNavigate()

  useEffect(() => {
    fetchRoles()
  }, [])

  const filteredRoles = roles.filter(r => 
    r.name.toLowerCase().includes(search.toLowerCase()) || 
    r.description?.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    await createRole(newRole, [])
    setIsCreateOpen(false)
    setNewRole({ name: "", description: "" })
  }

  return (
    <PageWrapper 
      title="Access Control & Roles" 
      description="Define enterprise roles, assign permissions, and control dynamic module visibility."
      actions={
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 font-bold">
          <Plus className="h-4 w-4" /> Create Custom Role
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Search Bar */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input 
            placeholder="Search roles by name or description..." 
            className="pl-9 h-11 bg-card/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRoles.map((role) => (
            <Card key={role.id} className="border-border/50 bg-card/30 hover:border-primary/30 transition-all group relative overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/roles/${role.id}`)} className="gap-2 cursor-pointer">
                        <Edit3 className="h-4 w-4" /> Edit Permissions
                      </DropdownMenuItem>
                      {!role.is_system && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => deleteRole(role.id)} 
                            className="gap-2 text-rose-500 focus:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" /> Delete Role
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="mt-4">
                  <CardTitle className="text-xl font-black tracking-tight">{role.name}</CardTitle>
                  <CardDescription className="line-clamp-2 mt-1 min-h-[40px]">{role.description || "No description provided."}</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-xs font-bold mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>0 Active Users</span>
                  </div>
                  <Badge variant={role.is_system ? "secondary" : "outline"} className="text-[9px] uppercase font-black px-1.5">
                    {role.is_system ? "System Role" : "Custom Role"}
                  </Badge>
                </div>
                
                <Button 
                  variant="ghost" 
                  className="w-full mt-4 justify-between group-hover:bg-primary/5 text-xs font-bold"
                  onClick={() => navigate(`/roles/${role.id}`)}
                >
                  Configure Matrix <ArrowRight className="h-3 w-3 translate-x-0 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create Role Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Enterprise Role</DialogTitle>
            <DialogDescription>
              Define a new role for your organization. You can configure granular permissions after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input 
                placeholder="e.g. Project Manager" 
                value={newRole.name}
                onChange={e => setNewRole(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea 
                placeholder="Explain the responsibilities of this role..." 
                value={newRole.description}
                onChange={e => setNewRole(p => ({ ...p, description: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newRole.name}>Create Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
