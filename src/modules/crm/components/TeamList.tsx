import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, Mail, Shield, UserCheck, UserX, ChevronDown } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTeamStore } from "@/modules/admin/teamStore"
import { useAuthStore } from "@/store/useAuthStore"
import { toast } from "sonner"

export function TeamList() {
  const { members, isLoading, fetchMembers, updateMemberStatus, updateMemberRole } = useTeamStore()
  const { profile: currentUser } = useAuthStore()
  const [search, setSearch] = useState("")
  const [tab, setTab] = useState<'active' | 'pending' | 'denied'>('active')

  useEffect(() => {
    fetchMembers()
  }, [])

  const pendingMembers = members.filter(m => m.status === 'pending')
  const activeMembers = members.filter(m => m.status === 'active')
  const deniedMembers = members.filter(m => m.status === 'denied')

  const displayMembers = (tab === 'active' ? activeMembers : tab === 'pending' ? pendingMembers : deniedMembers)
    .filter((member) =>
      member.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      member.email?.toLowerCase().includes(search.toLowerCase()) ||
      member.role.toLowerCase().includes(search.toLowerCase())
    )

  const isAdmin = currentUser?.role === 'admin'

  const roleColors: Record<string, string> = {
    admin: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    manager: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    employee: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    client: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  }

  const statusColors: Record<string, string> = {
    active: "text-emerald-500",
    pending: "text-amber-500",
    denied: "text-rose-500",
  }

  const handleApprove = async (id: string, name: string) => {
    try {
      await updateMemberStatus(id, 'active')
      toast.success(`${name || 'User'} approved successfully`)
    } catch {
      toast.error("Failed to approve user")
    }
  }

  const handleDeny = async (id: string, name: string) => {
    try {
      await updateMemberStatus(id, 'denied')
      toast.success(`${name || 'User'} access denied`)
    } catch {
      toast.error("Failed to deny user")
    }
  }

  const handleRoleChange = async (id: string, role: 'admin' | 'manager' | 'employee' | 'client') => {
    try {
      await updateMemberRole(id, role)
      toast.success(`Role updated to ${role}`)
    } catch {
      toast.error("Failed to update role")
    }
  }

  return (
    <div className="space-y-6">
      {/* Pending Alert Banner */}
      {pendingMembers.length > 0 && isAdmin && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
              <span className="text-xl">🔔</span>
            </div>
            <div>
              <p className="text-sm font-black text-amber-500">{pendingMembers.length} Pending Approval{pendingMembers.length > 1 ? 's' : ''}</p>
              <p className="text-xs text-muted-foreground">New users are waiting for admin approval to access the system.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10" onClick={() => setTab('pending')}>
            Review Now
          </Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {(['active', 'pending', 'denied'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
              tab === t
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {t}
            <span className={`ml-2 px-1.5 py-0.5 rounded-md text-[10px] ${
              tab === t ? 'bg-primary-foreground/20' : 'bg-muted'
            }`}>
              {t === 'active' ? activeMembers.length : t === 'pending' ? pendingMembers.length : deniedMembers.length}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b border-border/50">
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Member</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Role</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Registered</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Status</TableHead>
              {isAdmin && <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-32">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-muted-foreground">Loading members...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : displayMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground font-medium">
                  {tab === 'pending' ? 'No pending approvals 🎉' : `No ${tab} members found.`}
                </TableCell>
              </TableRow>
            ) : (
              displayMembers.map((member) => (
                <TableRow key={member.id} className="hover:bg-muted/20 transition-colors group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                        <AvatarImage src={member.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                          {member.full_name?.split(' ').map(n => n[0]).join('').toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold tracking-tight group-hover:text-primary transition-colors">
                          {member.full_name || "New User"}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          <Mail className="h-2.5 w-2.5" />
                          {member.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isAdmin && member.id !== currentUser?.id ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-1.5 h-7 px-2">
                            <Badge variant="outline" className={roleColors[member.role]}>
                              {member.role.toUpperCase()}
                            </Badge>
                            <ChevronDown className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {(['admin', 'manager', 'employee'] as const).map(role => (
                            <DropdownMenuItem key={role} onClick={() => handleRoleChange(member.id, role)} className="gap-2 capitalize">
                              {role}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge variant="outline" className={roleColors[member.role]}>
                        {member.role.toUpperCase()}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-muted-foreground">
                      {new Date(member.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        member.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
                        member.status === 'pending' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse' :
                        'bg-rose-500'
                      }`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${statusColors[member.status]}`}>
                        {member.status}
                      </span>
                    </div>
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {member.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                              onClick={() => handleApprove(member.id, member.full_name || '')}
                            >
                              <UserCheck className="h-3 w-3" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 gap-1.5 text-xs border-rose-500/30 text-rose-500 hover:bg-rose-500/10"
                              onClick={() => handleDeny(member.id, member.full_name || '')}
                            >
                              <UserX className="h-3 w-3" />
                              Deny
                            </Button>
                          </>
                        )}
                        {member.status === 'active' && member.id !== currentUser?.id && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1.5 text-xs text-rose-500 hover:bg-rose-500/10"
                            onClick={() => handleDeny(member.id, member.full_name || '')}
                          >
                            <UserX className="h-3 w-3" />
                            Revoke
                          </Button>
                        )}
                        {member.status === 'denied' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1.5 text-xs border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"
                            onClick={() => handleApprove(member.id, member.full_name || '')}
                          >
                            <UserCheck className="h-3 w-3" />
                            Reinstate
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-tight">Access Control</p>
          <p className="text-xs text-muted-foreground mt-1">
            New users register with <strong>Employee</strong> role and <strong>Pending</strong> status. 
            Only admins can approve access and change roles. Denied users cannot access any system data.
          </p>
        </div>
      </div>
    </div>
  )
}
