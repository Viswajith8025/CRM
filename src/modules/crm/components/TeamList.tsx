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
import { Search, Mail, UserCheck, Shield } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useTeamStore } from "@/modules/admin/teamStore"

export function TeamList() {
  const { members, isLoading, fetchMembers } = useTeamStore()
  const [search, setSearch] = useState("")

  useEffect(() => {
    fetchMembers()
  }, [])

  const filteredMembers = members
    .filter((member) => member.status === 'active')
    .filter((member) =>
      member.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      member.email?.toLowerCase().includes(search.toLowerCase()) ||
      member.role.toLowerCase().includes(search.toLowerCase())
    )

  const roleColors: Record<string, string> = {
    admin: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    manager: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    employee: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    client: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search registered members..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b border-border/50">
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Member</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Role</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Registration Date</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-32">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-muted-foreground">Loading registered members...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center h-32 text-muted-foreground font-medium">
                  No registered members found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => (
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
                    <Badge variant="outline" className={roleColors[member.role]}>
                      {member.role.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-tight">
                      {new Date(member.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Active</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-tight">Access Control Note</p>
          <p className="text-xs text-muted-foreground mt-1">
            This list shows only approved members of the CRM. Pending registrations must be approved by an administrator before appearing here.
          </p>
        </div>
      </div>
    </div>
  )
}
