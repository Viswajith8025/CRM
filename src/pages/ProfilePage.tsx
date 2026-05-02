import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuthStore } from "@/store/useAuthStore"
import { Mail, User, Shield, Calendar, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export default function ProfilePage() {
  const { user, updateProfile } = useAuthStore()
  const [fullName, setFullName] = useState("")
  const [role, setRole] = useState("User")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "")
      fetchProfile()
    }
  }, [user])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      if (data) setRole(data.role)
    } catch (error) {
      console.error("Error fetching profile:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async () => {
    if (!fullName.trim()) return toast.error("Full name cannot be empty")
    
    setIsUpdating(true)
    try {
      await updateProfile({ full_name: fullName })
      toast.success("Profile updated and synced")
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile")
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <PageWrapper 
      title="My Profile" 
      description="Manage your identity and account security across the workspace."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Identity Card */}
        <Card className="lg:col-span-1 border-border/50 bg-card/50">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="relative">
                <Avatar className="h-28 w-28 ring-4 ring-primary/10 shadow-2xl">
                  <AvatarImage src={user?.user_metadata?.avatar_url} />
                  <AvatarFallback className="text-3xl font-black bg-primary text-primary-foreground">
                    {user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-emerald-500 border-4 border-card shadow-sm" title="Active" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black tracking-tight">{fullName || "User"}</CardTitle>
            <CardDescription className="font-medium">{user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 pt-6 border-t border-border/50">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
                  <Shield className="h-3.5 w-3.5" /> Access Level
                </div>
                <span className="font-black capitalize px-2 py-0.5 rounded bg-primary/10 text-primary">{isLoading ? "..." : role}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
                  <Calendar className="h-3.5 w-3.5" /> Member Since
                </div>
                <span className="font-bold">{new Date(user?.created_at || "").toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Context */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your display name and contact details used in teams.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      id="fullName" 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10 font-medium" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-black uppercase tracking-widest text-muted-foreground">Email (Primary)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input id="email" defaultValue={user?.email} disabled className="pl-10 opacity-60 font-medium cursor-not-allowed" />
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button 
                  className="font-black px-10 rounded-xl" 
                  onClick={handleSave}
                  disabled={isUpdating}
                >
                  {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className={cn("border-border/50 border-dashed bg-transparent transition-opacity", role === 'manager' && "opacity-75")}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Account Settings
                {role === 'manager' && <Shield className="h-3 w-3 text-amber-500" />}
              </CardTitle>
              <CardDescription className="text-xs">
                To manage security, passwords, or two-factor authentication, please visit the 
                <Button 
                  variant="link" 
                  className="h-auto p-0 px-1 text-xs font-bold" 
                  onClick={() => {
                    if (role === 'manager') {
                      toast.error("Access Restricted: You don't have permission to manage workspace settings.")
                    } else {
                      window.location.href='/settings'
                    }
                  }}
                >
                  Workspace Settings
                </Button> 
                tab.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </PageWrapper>
  )
}
