import { useEffect, useState } from "react"
import { useTeamStore } from "../teamStore"
import { useAuthStore } from "@/store/useAuthStore"
import { useSettingsStore } from "../settingsStore"
import { DepartmentsTab } from "../components/DepartmentsTab"
import { 
  Loader2, 
  Building2, 
  UserPlus, 
  Shield, 
  Bell, 
  Lock, 
  MoreVertical,
  Building,
  Mail,
  Globe,
  Hash
} from "lucide-react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"

export default function SettingsPage() {
  const { members, dynamicRoles, fetchMembers, fetchDynamicRoles, isLoading: teamLoading, assignDynamicRole, revokeAccess } = useTeamStore()
  const { settings, fetchSettings, isLoading: settingsLoading, updateSettings } = useSettingsStore()
  const { profile: currentUser } = useAuthStore()
  const isSuperAdmin = currentUser?.role === 'super_admin'
  
  // Company Form State
  const [companyName, setCompanyName] = useState("")
  const [taxId, setTaxId] = useState("")
  const [email, setEmail] = useState("")
  const [website, setWebsite] = useState("")
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Invite Form State
  const [isInviteOpen, setIsInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("employee")
  const [isInviting, setIsInviting] = useState(false)

  // Security State
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false)

  // Revoke State
  const [revokeId, setRevokeId] = useState<string | null>(null)

  useEffect(() => {
    fetchMembers()
    fetchDynamicRoles()
    fetchSettings()
  }, [])

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || "")
      setTaxId(settings.tax_id || "")
      setEmail(settings.corporate_email || "")
      setWebsite(settings.website || "")
      setLogoUrl(settings.logo_url || null)
    }
  }, [settings])

  const handleSaveSettings = async () => {
    if (!companyName) return toast.error("Company name is required")
    setIsUpdating(true)
    try {
      await updateSettings({
        company_name: companyName,
        tax_id: taxId,
        corporate_email: email,
        website: website,
        logo_url: logoUrl
      })
      toast.success("Organization settings updated")
    } catch (error) {
      toast.error("Failed to update settings")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleInviteSubmit = async () => {
    if (!inviteEmail) return toast.error("Email is required")
    setIsInviting(true)
    try {
      // Use Magic Link as an invitation mechanism for client-side apps
      const { error } = await supabase.auth.signInWithOtp({
        email: inviteEmail,
        options: {
          shouldCreateUser: true,
          data: {
            role: inviteRole
          }
        }
      })
      
      if (error) throw error

      toast.success(`Magic link invitation sent to ${inviteEmail}`)
      setIsInviteOpen(false)
      setInviteEmail("")
    } catch (error: any) {
      toast.error(error.message || "Failed to send invitation")
    } finally {
      setIsInviting(false)
    }
  }

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      return toast.error("File is too large. Max size is 2MB.")
    }

    const reader = new FileReader()
    reader.onloadend = () => {
      const base64String = reader.result as string
      setLogoUrl(base64String)
      toast.success("Logo processed! Click 'Save Changes' to apply.")
    }
    reader.readAsDataURL(file)
  }

  const handlePasswordUpdate = async () => {
    if (!newPassword) return toast.error("Password cannot be empty")
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match")
    
    setIsUpdatingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      toast.success("Password updated successfully")
      setNewPassword("")
      setConfirmPassword("")
    } catch (error: any) {
      toast.error(error.message || "Failed to update password")
    } finally {
      setIsUpdatingPassword(false)
    }
  }

  const handleRevoke = async () => {
    if (!revokeId) return
    try {
      await revokeAccess(revokeId)
      toast.success("Access revoked successfully")
    } catch (error) {
      toast.error("Failed to revoke access")
    } finally {
      setRevokeId(null)
    }
  }

  if (teamLoading || settingsLoading) {
    return (
      <div className="flex h-[600px] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-medium text-muted-foreground">Loading organization settings...</p>
      </div>
    )
  }

  return (
    <PageWrapper 
      title="Settings" 
      description="Manage your organization, team, and security preferences."
    >
      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="company" className="gap-2"><Building2 className="h-4 w-4" /> Company</TabsTrigger>
          <TabsTrigger value="team" className="gap-2"><UserPlus className="h-4 w-4" /> Team</TabsTrigger>
          <TabsTrigger value="departments" className="gap-2"><Building className="h-4 w-4" /> Departments</TabsTrigger>
          <TabsTrigger value="approvals" className="relative gap-2">
            <Shield className="h-4 w-4" /> Approvals
            {members.filter(m => m.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">
                {members.filter(m => m.status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="h-4 w-4" /> Security</TabsTrigger>
        </TabsList>

        {/* Company Profile */}
        <TabsContent value="company" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Organization Profile</CardTitle>
              <CardDescription>Update your company information and public-facing branding.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20 ring-4 ring-primary/10 bg-transparent">
                  {logoUrl ? (
                    <AvatarImage src={logoUrl} alt="Company Logo" className="object-contain" />
                  ) : null}
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-black">
                    {companyName.charAt(0) || "EP"}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Input 
                    type="file" 
                    id="logo-upload" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleLogoUpload} 
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => document.getElementById('logo-upload')?.click()}
                  >
                    Change Logo
                  </Button>
                  <p className="text-xs text-muted-foreground font-medium">PNG, JPG or SVG. Max 2MB.</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Building className="h-3 w-3" /> Company Name</Label>
                  <Input 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)} 
                    placeholder="e.g. Acme Corp"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Hash className="h-3 w-3" /> Tax ID / VAT Number</Label>
                  <Input 
                    placeholder="e.g. VAT1234567" 
                    value={taxId} 
                    onChange={(e) => setTaxId(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Mail className="h-3 w-3" /> Corporate Email</Label>
                  <Input 
                    type="email"
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    placeholder="billing@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Globe className="h-3 w-3" /> Website</Label>
                  <Input 
                    value={website} 
                    onChange={(e) => setWebsite(e.target.value)} 
                    placeholder="https://company.com"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveSettings} disabled={isUpdating} className="font-bold">
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Management */}
        <TabsContent value="team" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Invite and manage roles for your team.</CardDescription>
              </div>
              <Button className="gap-2 font-bold" onClick={() => setIsInviteOpen(true)}>
                <UserPlus className="h-4 w-4" /> Invite Member
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {members.filter(m => (!m.status || m.status === 'active') && m.role !== 'super_admin').length === 0 ? (
                  <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground font-medium">
                    No active team members found.
                  </div>
                ) : (
                  members.filter(m => (!m.status || m.status === 'active') && m.role !== 'super_admin').map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/30 transition-all hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border-2 border-background">
                          <AvatarImage src={member.avatar_url || ""} />
                          <AvatarFallback className="font-bold">{member.full_name?.charAt(0) || member.email?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-bold">{member.full_name || "Invited User"}</p>
                          <p className="text-xs text-muted-foreground font-medium">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <Badge variant="outline" className="capitalize px-3 py-0.5 font-bold tracking-tight bg-background">
                          {member.dynamic_role_name || member.role}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {dynamicRoles.map(role => (
                              <DropdownMenuItem 
                                key={role.id}
                                onClick={async () => {
                                  try { 
                                    await assignDynamicRole(member.id, role.id)
                                    toast.success(`Role updated to ${role.name}.`) 
                                  }
                                  catch (e: any) { toast.error(e.message) }
                                }} 
                                className="font-medium"
                                disabled={member.dynamic_role_id === role.id}
                              >
                                <Shield className="mr-2 h-3.5 w-3.5 text-primary" /> {role.name}
                                {member.dynamic_role_id === role.id && <span className="ml-auto text-[10px] text-primary font-black">CURRENT</span>}
                              </DropdownMenuItem>
                            ))}
                            <Separator className="my-1" />
                            <DropdownMenuItem 
                              className="text-rose-500 font-bold focus:text-rose-600 focus:bg-rose-50" 
                              onClick={() => setRevokeId(member.id)}
                            >
                              Revoke Access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Departments Management */}
        <TabsContent value="departments" className="space-y-6">
          <DepartmentsTab />
        </TabsContent>

        {/* User Approvals */}
        <TabsContent value="approvals" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>Review and approve new user registrations for your workspace.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {members.filter(m => m.status === 'pending').length === 0 ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-muted/20 text-muted-foreground">
                    <Shield className="h-8 w-8 opacity-20" />
                    <p className="text-sm font-bold tracking-tight">No pending registrations</p>
                  </div>
                ) : (
                  members.filter(m => m.status === 'pending').map((member) => (
                    <div key={member.id} className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-card shadow-sm">
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 border-2 border-primary/10">
                          <AvatarImage src={member.avatar_url || ""} />
                          <AvatarFallback className="font-black text-lg">{member.full_name?.charAt(0) || member.email?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-base font-black tracking-tighter">{member.full_name || "New User"}</p>
                          <p className="text-xs text-muted-foreground font-medium">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="font-bold text-rose-500 border-rose-500/20 hover:bg-rose-50 hover:text-rose-600"
                          onClick={() => useTeamStore.getState().updateMemberStatus(member.id, 'denied')}
                        >
                          Deny
                        </Button>
                        <Button 
                          className="font-bold bg-emerald-500 hover:bg-emerald-600 text-white"
                          onClick={() => {
                            useTeamStore.getState().updateMemberStatus(member.id, 'active')
                            toast.success(`${member.full_name || member.email} has been approved!`)
                          }}
                        >
                          Approve Access
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Communication Preferences</CardTitle>
              <CardDescription>Control how and when you receive system alerts.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-6">
                {[
                  { id: 'leads', title: 'New Leads', desc: 'Get notified when a new prospect is assigned to you.' },
                  { id: 'milestones', title: 'Milestone Alerts', desc: 'Receive updates when project goals are reached.' },
                  { id: 'billing', title: 'Invoice Updates', desc: 'Alerts for paid, overdue, or cancelled invoices.' }
                ].map((pref, i) => (
                  <div key={pref.id}>
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-bold">{pref.title}</Label>
                        <p className="text-xs text-muted-foreground font-medium">{pref.desc}</p>
                      </div>
                      <Switch defaultChecked={i < 2} />
                    </div>
                    {i < 2 && <Separator className="mt-6" />}
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => toast.success("Notification preferences updated")} className="font-bold">Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Account Security</CardTitle>
              <CardDescription>Update your credentials and manage access control.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border border-border/50 opacity-60">
                <div className="space-y-0.5">
                  <Label className="flex items-center gap-2 text-sm font-bold"><Shield className="h-4 w-4 text-muted-foreground" /> Two-Factor Authentication</Label>
                  <p className="text-xs text-muted-foreground font-medium">MFA is currently managed by the Identity Provider.</p>
                </div>
                <Button variant="ghost" size="sm" disabled className="font-bold">Managed</Button>
              </div>
              
              <div className="space-y-4">
                <Label className="text-sm font-bold">Change Password</Label>
                <div className="grid gap-4 max-w-md">
                  <Input 
                    type="password" 
                    placeholder="New Password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <Input 
                    type="password" 
                    placeholder="Confirm New Password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <Button 
                    className="w-fit font-bold" 
                    onClick={handlePasswordUpdate}
                    disabled={isUpdatingPassword}
                  >
                    {isUpdatingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Update Password
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an email invitation to join your organization.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input 
                type="email" 
                placeholder="colleague@company.com" 
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dynamicRoles.map(role => (
                    <SelectItem key={role.id} value={role.name.toLowerCase()}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInviteOpen(false)}>Cancel</Button>
            <Button onClick={handleInviteSubmit} disabled={isInviting} className="font-bold">
              {isInviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Access Alert */}
      <AlertDialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Access?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately terminate the user's access to the organization. This action can be reversed by re-inviting them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRevoke} className="bg-rose-500 hover:bg-rose-600 text-white">
              Revoke Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageWrapper>
  )
}

function Badge({ children, variant, className }: any) {
  return (
    <span className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      variant === 'outline' ? 'border border-border text-foreground' : 'bg-primary text-primary-foreground',
      className
    )}>
      {children}
    </span>
  )
}
