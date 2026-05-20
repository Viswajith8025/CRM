import { useEffect, useState } from "react"
import { 
  Settings2, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  UserPlus, 
  Save, 
  Plus, 
  Trash2,
  Lock,
  ChevronRight,
  ShieldAlert
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useTimeDeskSettingsStore } from "../timeDeskSettingsStore"
import { cn } from "@/lib/utils"

export default function TimeDeskSettings() {
  const { 
    workSettings, 
    leavePolicies, 
    isLoading, 
    fetchSettings, 
    updateWorkSettings, 
    fetchLeavePolicies, 
    upsertLeavePolicy, 
    deleteLeavePolicy 
  } = useTimeDeskSettingsStore()

  const [activeTab, setActiveTab] = useState("tracking")
  const [isEditing, setIsEditing] = useState(false)
  const [localSettings, setLocalSettings] = useState<any>(null)

  useEffect(() => {
    fetchSettings()
    fetchLeavePolicies()
  }, [])

  // Sync local settings when workSettings is fetched or edit is toggled
  useEffect(() => {
    if (workSettings) {
      setLocalSettings(workSettings)
    }
  }, [workSettings, isEditing])

  const handleUpdateDay = (day: string, checked: boolean) => {
    if (!localSettings) return
    const newDays = { ...localSettings.working_days, [day]: checked }
    setLocalSettings({ ...localSettings, working_days: newDays })
  }

  const handleSave = async () => {
    if (!localSettings) return
    await updateWorkSettings(localSettings)
    setIsEditing(false)
  }

  const handleNewPolicy = async () => {
    const name = window.prompt("Enter Policy Name (e.g., Casual Leave, Sick Leave):")
    if (!name) return

    await upsertLeavePolicy({
      policy_name: name,
      yearly_limit: 8,
      monthly_cap: 1,
      is_paid: true
    })
  }

  return (
    <PageWrapper
      title="Time Desk Governance"
      description="Configure organization-wide work policies, shift schedules, and security protocols."
    >
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="space-y-1">
            <button 
              onClick={() => setActiveTab("tracking")}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === "tracking" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-primary/5"
              )}
            >
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4" />
                Tracking Rules
              </div>
              <ChevronRight className={cn("h-4 w-4 opacity-50", activeTab === "tracking" && "rotate-90")} />
            </button>
            <button 
              onClick={() => setActiveTab("schedule")}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === "schedule" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-primary/5"
              )}
            >
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4" />
                Working Days
              </div>
              <ChevronRight className={cn("h-4 w-4 opacity-50", activeTab === "schedule" && "rotate-90")} />
            </button>
            <button 
              onClick={() => setActiveTab("leave")}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === "leave" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-primary/5"
              )}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-4 w-4" />
                Leave Policies
              </div>
              <ChevronRight className={cn("h-4 w-4 opacity-50", activeTab === "leave" && "rotate-90")} />
            </button>
            <button 
              onClick={() => setActiveTab("provisioning")}
              className={cn(
                "w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all",
                activeTab === "provisioning" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:bg-primary/5"
              )}
            >
              <div className="flex items-center gap-3">
                <UserPlus className="h-4 w-4" />
                Team Provisioning
              </div>
              <ChevronRight className={cn("h-4 w-4 opacity-50", activeTab === "provisioning" && "rotate-90")} />
            </button>
          </div>

          <div className="mt-8 p-4 rounded-2xl bg-rose-50 border border-rose-100">
            <div className="flex items-center gap-2 text-rose-600 mb-2">
              <ShieldAlert className="h-4 w-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">Admin Control</span>
            </div>
            <p className="text-[10px] text-rose-500 font-bold uppercase leading-relaxed">
              These settings enforce strict organizational compliance. Changes are audited in real-time.
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          <div className="flex justify-end items-center gap-3 mb-6">
            {isEditing && (
              <Button 
                onClick={handleSave}
                disabled={isLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-widest gap-2 h-10 px-6 rounded-xl shadow-lg shadow-emerald-500/20"
              >
                <Save className="h-3 w-3" />
                {isLoading ? "Saving..." : "Save Configuration"}
              </Button>
            )}
            <Button 
              variant={isEditing ? "outline" : "default"}
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                "font-black uppercase text-[10px] tracking-widest gap-2 h-10 px-6 rounded-xl transition-all",
                isEditing ? "border-rose-200 text-rose-600 hover:bg-rose-50" : "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
              )}
            >
              {isEditing ? (
                <>
                  <Lock className="h-3 w-3" />
                  Cancel Editing
                </>
              ) : (
                <>
                  <Settings2 className="h-3 w-3" />
                  Edit Configuration
                </>
              )}
            </Button>
          </div>

          {activeTab === "tracking" && (
            <div className="space-y-6">
              <Card className="bg-card border-border/40 overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-border/10">
                  <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Tracking Core Logic
                  </CardTitle>
                  <CardDescription className="text-[10px] font-bold uppercase">Configure how employee time is calculated and enforced.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Minimum Daily Hours</Label>
                        <Input 
                          type="number" 
                          disabled={!isEditing}
                          value={localSettings?.min_working_hours ?? 8}
                          onChange={(e) => setLocalSettings({ ...localSettings, min_working_hours: parseInt(e.target.value) })}
                          className="border-border/40 focus:ring-primary h-12 text-lg font-black tracking-tighter disabled:opacity-50"
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-border/10 bg-muted/30">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest">Flexible Mode</Label>
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">Disable strict start/end times.</p>
                        </div>
                        <Switch 
                          disabled={!isEditing}
                          checked={localSettings?.is_flexible_mode || false} 
                          onCheckedChange={(checked) => setLocalSettings({ ...localSettings, is_flexible_mode: checked })}
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Late Threshold (Minutes)</Label>
                        <Input 
                          type="number" 
                          disabled={!isEditing}
                          value={localSettings?.late_threshold_minutes ?? 15}
                          onChange={(e) => setLocalSettings({ ...localSettings, late_threshold_minutes: parseInt(e.target.value) })}
                          className="border-border/40 focus:ring-primary h-12 text-lg font-black tracking-tighter disabled:opacity-50"
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 rounded-xl border border-border/10 bg-muted/30">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-black uppercase tracking-widest">Productivity Tracking</Label>
                          <p className="text-[10px] text-muted-foreground uppercase font-medium">Enable task-time correlation.</p>
                        </div>
                        <Switch 
                          disabled={!isEditing}
                          checked={localSettings?.track_productivity || false} 
                          onCheckedChange={(checked) => setLocalSettings({ ...localSettings, track_productivity: checked })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Break Limit Row */}
                  <div className="pt-2 border-t border-border/10">
                    <div className="flex items-start gap-4 p-4 rounded-xl border border-amber-100 bg-amber-50/60">
                      <div className="p-2 bg-amber-100 rounded-lg shrink-0">
                        <Clock className="h-4 w-4 text-amber-600" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <Label className="text-[10px] font-black uppercase tracking-widest text-amber-700">Max Break Time Per Shift</Label>
                          <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                            Total cumulative break minutes allowed per work session. Employees cannot start new breaks once this limit is reached.
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <Input 
                            type="number"
                            min={0}
                            max={480}
                            disabled={!isEditing}
                            value={localSettings?.max_break_minutes ?? 60}
                            onChange={(e) => setLocalSettings({ ...localSettings, max_break_minutes: parseInt(e.target.value) })}
                            className="border-amber-200 focus:ring-amber-400 h-11 text-lg font-black tracking-tighter disabled:opacity-50 max-w-[120px] bg-white"
                          />
                          <span className="text-sm font-black text-amber-600 uppercase tracking-widest">Minutes</span>
                          <span className="text-[10px] text-amber-500 font-bold">
                            = {Math.floor((localSettings?.max_break_minutes ?? 60) / 60)}h {(localSettings?.max_break_minutes ?? 60) % 60}m per shift
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border/40">
                <CardHeader>
                  <CardTitle className="text-xs font-black uppercase tracking-widest">Standard Shift Schedule</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Default Start Time</Label>
                    <Input 
                      type="time" 
                      disabled={!isEditing}
                      value={localSettings?.default_shift_start?.slice(0, 5) || '09:00'}
                      onChange={(e) => setLocalSettings({ ...localSettings, default_shift_start: e.target.value })}
                      className="border-border/40 h-10 font-bold disabled:opacity-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Default End Time</Label>
                    <Input 
                      type="time" 
                      disabled={!isEditing}
                      value={localSettings?.default_shift_end?.slice(0, 5) || '18:00'}
                      onChange={(e) => setLocalSettings({ ...localSettings, default_shift_end: e.target.value })}
                      className="border-border/40 h-10 font-bold disabled:opacity-50"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "schedule" && (
            <Card className="bg-card border-border/40">
              <CardHeader className="bg-primary/5 border-b border-border/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Working Days & Weekend Setup
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase">Define the standard work week for your organization.</CardDescription>
              </CardHeader>
              <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => (
                  <div key={day} className={cn(
                    "p-4 rounded-2xl border transition-all flex flex-col items-center justify-center gap-3",
                    localSettings?.working_days?.[day] ? "border-primary/20 bg-primary/5 shadow-sm" : "border-border/10 bg-muted/20 opacity-60"
                  )}>
                    <span className="text-xs font-black uppercase tracking-widest">{day}</span>
                    <Switch 
                      disabled={!isEditing}
                      checked={localSettings?.working_days?.[day] || false} 
                      onCheckedChange={(checked) => handleUpdateDay(day, checked)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeTab === "leave" && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Active Leave Policies</h3>
                <Button 
                  disabled={!isEditing}
                  onClick={handleNewPolicy}
                  className="bg-primary hover:bg-primary/90 text-xs font-black uppercase tracking-widest gap-2 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  New Policy
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {leavePolicies.map((policy) => (
                  <Card key={policy.id} className="bg-card border-border/40 relative group">
                    <CardHeader>
                      <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center justify-between">
                        {policy.policy_name}
                        {isEditing && (
                          <Button variant="ghost" size="icon" onClick={() => deleteLeavePolicy(policy.id)} className="h-8 w-8 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/10">
                          <p className="text-[10px] font-black uppercase text-muted-foreground">Yearly Limit</p>
                          <p className="text-xl font-black text-primary tracking-tighter">{policy.yearly_limit} Days</p>
                        </div>
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/10">
                          <p className="text-[10px] font-black uppercase text-muted-foreground">Monthly Cap</p>
                          <p className="text-xl font-black text-primary tracking-tighter">{policy.monthly_cap} Days</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {leavePolicies.length === 0 && (
                  <div className="col-span-full py-20 text-center border-2 border-dashed border-border/20 rounded-3xl">
                    <ShieldCheck className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No Leave Policies Configured</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "provisioning" && (
            <Card className="bg-card border-border/40">
              <CardHeader className="bg-primary/5 border-b border-border/10">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-primary" />
                  User Onboarding & Invitations
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Email Address</Label>
                    <Input disabled={!isEditing} placeholder="employee@company.com" className="border-border/40 disabled:opacity-50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase">Full Name</Label>
                    <Input disabled={!isEditing} placeholder="John Doe" className="border-border/40 disabled:opacity-50" />
                  </div>
                  <div className="flex items-end">
                    <Button disabled={!isEditing} className="w-full bg-primary hover:bg-primary/90 font-black uppercase text-xs tracking-widest gap-2 disabled:opacity-50">
                      <UserPlus className="h-4 w-4" />
                      Send Invite
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
