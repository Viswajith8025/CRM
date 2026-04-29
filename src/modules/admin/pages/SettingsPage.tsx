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
  UserPlus, 
  Shield, 
  Bell, 
  Building2, 
  Palette, 
  Lock,
  Mail,
  MoreVertical
} from "lucide-react"

export default function SettingsPage() {
  return (
    <PageWrapper 
      title="Settings" 
      description="Manage your organization, team, and security preferences."
    >
      <Tabs defaultValue="company" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="company" className="gap-2"><Building2 className="h-4 w-4" /> Company</TabsTrigger>
          <TabsTrigger value="team" className="gap-2"><UserPlus className="h-4 w-4" /> Team</TabsTrigger>
          <TabsTrigger value="roles" className="gap-2"><Shield className="h-4 w-4" /> Roles</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" /> Notifications</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="h-4 w-4" /> Security</TabsTrigger>
        </TabsList>

        {/* Company Profile */}
        <TabsContent value="company" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Organization Profile</CardTitle>
              <CardDescription>Update your company information and branding.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground font-bold">EP</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" size="sm">Change Logo</Button>
                  <p className="text-xs text-muted-foreground">JPG, GIF or PNG. Max size of 800K</p>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Company Name</Label>
                  <Input defaultValue="ERP Pro Services Ltd." />
                </div>
                <div className="space-y-2">
                  <Label>Tax ID / VAT Number</Label>
                  <Input placeholder="EU123456789" />
                </div>
                <div className="space-y-2">
                  <Label>Corporate Email</Label>
                  <Input defaultValue="admin@erppro.com" />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <Input defaultValue="https://erppro.com" />
                </div>
              </div>
              <div className="flex justify-end">
                <Button>Save Changes</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Team Management */}
        <TabsContent value="team" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Invite and manage your organization's team members.</CardDescription>
              </div>
              <Button className="gap-2">
                <UserPlus className="h-4 w-4" /> Invite Member
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: 'John Doe', email: 'john@erppro.com', role: 'Admin', status: 'Active' },
                  { name: 'Sarah Smith', email: 'sarah@erppro.com', role: 'Manager', status: 'Active' },
                  { name: 'Mike Ross', email: 'mike@erppro.com', role: 'Employee', status: 'Pending' },
                ].map((member) => (
                  <div key={member.email} className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{member.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-bold">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-8">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-muted">{member.role}</span>
                      <span className={`text-xs ${member.status === 'Active' ? 'text-emerald-500' : 'text-amber-500'}`}>{member.status}</span>
                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Configure when you want to receive emails.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>New Leads</Label>
                    <p className="text-xs text-muted-foreground">Receive an email when a new lead is assigned to you.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Project Milestones</Label>
                    <p className="text-xs text-muted-foreground">Get notified when a project milestone is completed.</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Billing Alerts</Label>
                    <p className="text-xs text-muted-foreground">Receive notifications for paid and overdue invoices.</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Security Preferences</CardTitle>
              <CardDescription>Manage your authentication and security settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2"><Lock className="h-4 w-4" /> Two-Factor Authentication</Label>
                    <p className="text-xs text-muted-foreground">Add an extra layer of security to your account.</p>
                  </div>
                  <Button variant="outline">Enable</Button>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Change Password</Label>
                  <div className="grid gap-4 max-w-sm">
                    <Input type="password" placeholder="Current Password" />
                    <Input type="password" placeholder="New Password" />
                    <Button className="w-fit">Update Password</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageWrapper>
  )
}
