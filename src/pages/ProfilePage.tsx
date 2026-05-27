import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuthStore } from "@/store/useAuthStore"
import { Mail, User, Shield, Calendar, Loader2, Building2, Camera } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { usePermissions } from "@/hooks/usePermissions"
import Cropper from "react-easy-crop"
import getCroppedImg from "@/lib/cropImage"

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuthStore()
  const { hasPermission } = usePermissions()
  const [fullName, setFullName] = useState("")
  const [isUpdating, setIsUpdating] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [departmentName, setDepartmentName] = useState<string>("Not Assigned")

  // Crop State
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [isCropDialogOpen, setIsCropDialogOpen] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "")
    }
  }, [profile])

  useEffect(() => {
    if (!profile?.id) return

    const fetchUserDepartment = async () => {
      try {
        const { data, error } = await supabase
          .from("department_members")
          .select(`
            department:departments(
              name
            )
          `)
          .eq("profile_id", profile.id)
          .maybeSingle()

        if (!error && data) {
          const dept = data.department as any
          if (dept && dept.name) {
            setDepartmentName(dept.name)
          }
        }
      } catch (err) {
        console.error("Failed to fetch user department:", err)
      }
    }

    fetchUserDepartment()
  }, [profile])

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      setSelectedImage(reader.result as string)
      setIsCropDialogOpen(true)
    }
    reader.readAsDataURL(file)
    // reset input so the same file can be selected again if needed
    event.target.value = ""
  }

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }

  const handleCropAndUpload = async () => {
    if (!selectedImage || !croppedAreaPixels) return

    setIsUploading(true)
    setIsCropDialogOpen(false)
    try {
      const croppedFile = await getCroppedImg(selectedImage, croppedAreaPixels)
      if (!croppedFile) throw new Error("Failed to crop image")

      const fileExt = 'jpeg'
      const filePath = `${profile?.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, croppedFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: croppedFile.type
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      await updateProfile({ avatar_url: publicUrl })
      toast.success("Profile photo updated successfully!")
    } catch (error: any) {
      toast.error(error.message || "Failed to upload photo")
    } finally {
      setIsUploading(false)
      setSelectedImage(null)
    }
  }

  const roleDisplay = profile?.dynamic_role || profile?.role || "User"
  const canAccessSettings = hasPermission('module.admin')

  return (
    <PageWrapper 
      title="My Profile" 
      description="Manage your identity and account security across the workspace."
    >
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Identity Card */}
        <Card className="lg:col-span-1 border-border/50 bg-card/50">
          <CardHeader className="text-center">
            <div className="flex flex-col items-center justify-center mb-4 gap-2">
              <div 
                className={cn("relative group cursor-pointer rounded-full", isUploading ? "opacity-50" : "")} 
                onClick={() => document.getElementById('avatarUpload')?.click()}
              >
                <Avatar className="h-28 w-28 ring-4 ring-primary/10 shadow-2xl transition-all group-hover:brightness-50">
                  <AvatarImage src={profile?.avatar_url || user?.user_metadata?.avatar_url} className="object-cover" />
                  <AvatarFallback className="text-3xl font-black bg-primary text-primary-foreground">
                    {profile?.full_name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full z-10">
                  <Camera className="h-8 w-8 text-white drop-shadow-md" />
                </div>
                <div className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-emerald-500 border-4 border-card shadow-sm z-20" title="Active" />
                <input 
                  type="file" 
                  id="avatarUpload" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleFileSelect}
                  disabled={isUploading}
                />
              </div>
              {isUploading && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Uploading...</span>}
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
                <span className="font-black capitalize px-2 py-0.5 rounded bg-primary/10 text-primary">{roleDisplay}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
                  <Building2 className="h-3.5 w-3.5" /> Department
                </div>
                <span className="font-black capitalize px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">{departmentName}</span>
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

          <Card className={cn("border-border/50 border-dashed bg-transparent transition-opacity", !canAccessSettings && "opacity-75")}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                Account Settings
                {!canAccessSettings && <Shield className="h-3 w-3 text-amber-500" />}
              </CardTitle>
              <CardDescription className="text-xs">
                To manage security, passwords, or two-factor authentication, please visit the 
                <Button 
                  variant="link" 
                  className="h-auto p-0 px-1 text-xs font-bold" 
                  onClick={() => {
                    if (!canAccessSettings) {
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

      <Dialog open={isCropDialogOpen} onOpenChange={setIsCropDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop Profile Picture</DialogTitle>
          </DialogHeader>
          <div className="relative h-[300px] w-full bg-muted/20 rounded-xl overflow-hidden my-4">
            {selectedImage && (
              <Cropper
                image={selectedImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
              />
            )}
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-muted-foreground uppercase">Zoom</span>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => {
                  setZoom(Number(e.target.value))
                }}
                className="w-full"
              />
            </div>
            <DialogFooter className="sm:justify-end">
              <Button type="button" variant="ghost" onClick={() => setIsCropDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={handleCropAndUpload} className="font-bold">
                Crop & Save
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
