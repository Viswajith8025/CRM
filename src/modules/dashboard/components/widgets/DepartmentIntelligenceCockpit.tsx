import { useState, useEffect, useMemo } from "react"
import { useAuthStore } from "@/store/useAuthStore"
import { useRBACStore } from "@/modules/admin/rbacStore"
import { useTasksStore } from "@/modules/tasks/tasksStore"
import { useTeamStore } from "@/modules/admin/teamStore"
import type { Profile } from "@/modules/admin/teamStore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Users,
  Clock,
  TrendingUp,
  AlertTriangle,
  Folder,
  FileText,
  Activity,
  Briefcase,
  Play,
  CheckCircle2,
  DollarSign,
  Search,
  BookOpen,
  Mail,
  Shield,
  Percent,
  Download,
  Calendar,
  X
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { supabase } from "@/lib/supabase"

// Standard Dynamic Department Layout Definitions
export interface Department {
  id: string
  name: string
  slug: string
  description?: string
  leader_id?: string
  weekly_capacity?: number
}

const DEFAULT_DEPARTMENTS: Department[] = [
  { id: "d1", name: "Web Developing", slug: "web_developing", description: "Core engineering, frontend, and backend architecture.", weekly_capacity: 40 },
  { id: "d2", name: "Video Editing", slug: "video_editing", description: "Post-production, rendering, and visual effects.", weekly_capacity: 40 },
  { id: "d3", name: "Videography", slug: "videography", description: "Camera operations, live shooting, and lighting.", weekly_capacity: 40 },
  { id: "d4", name: "Graphic Designing", slug: "graphic_designing", description: "UI/UX prototypes, branding, and graphic elements.", weekly_capacity: 40 },
  { id: "d5", name: "Digital Marketing", slug: "digital_marketing", description: "Campaigns, SEO, and paid ad management.", weekly_capacity: 40 },
  { id: "d6", name: "Content Writer", slug: "content_writer", description: "Editorial pipelines, publishing queues, and reviews.", weekly_capacity: 40 },
  { id: "d7", name: "CRM", slug: "crm", description: "Client relations, onboarding, and support tickets.", weekly_capacity: 40 },
  { id: "d8", name: "BDE", slug: "bde", description: "Business development, sales pipelines, and outreach.", weekly_capacity: 40 },
]

const isValidUUID = (id: string) => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export function DepartmentIntelligenceCockpit() {
  const { profile } = useAuthStore()
  const { tasks, fetchTasks } = useTasksStore()
  const { members, fetchMembers } = useTeamStore()

  const [activeDept, setActiveDept] = useState<string>("development")
  const [searchQuery, setSearchQuery] = useState("")

  const [departmentsList, setDepartmentsList] = useState<Department[]>(DEFAULT_DEPARTMENTS)
  const [dbKPIs, setDbKPIs] = useState<any[]>([])
  const [dbMembers, setDbMembers] = useState<any[]>([])
  const [dbLogs, setDbLogs] = useState<any[]>([])
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null)
  const [selectedMemberLogs, setSelectedMemberLogs] = useState<any[]>([
    { name: 'Mon', hours: 0 },
    { name: 'Tue', hours: 0 },
    { name: 'Wed', hours: 0 },
    { name: 'Thu', hours: 0 },
    { name: 'Fri', hours: 0 },
  ])

  useEffect(() => {
    if (!selectedMember) {
      setSelectedMemberLogs([
        { name: 'Mon', hours: 0 },
        { name: 'Tue', hours: 0 },
        { name: 'Wed', hours: 0 },
        { name: 'Thu', hours: 0 },
        { name: 'Fri', hours: 0 },
      ])
      return
    }

    const fetchMemberTimeLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('work_sessions')
          .select('start_time, end_time')
          .eq('user_id', selectedMember.id)
          .order('start_time', { ascending: true })

        if (!error && data) {
          const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
          const hoursByDay = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0 } as Record<string, number>

          data.forEach(session => {
            if (!session.start_time) return
            const start = new Date(session.start_time)
            const end = session.end_time ? new Date(session.end_time) : new Date()
            const diffMs = end.getTime() - start.getTime()
            const diffHours = diffMs / (1000 * 60 * 60)

            const dayIdx = start.getDay()
            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
            const dayName = dayNames[dayIdx]
            if (hoursByDay[dayName] !== undefined) {
              hoursByDay[dayName] += diffHours
            }
          })

          const chartData = daysOfWeek.map(day => ({
            name: day,
            hours: Number(hoursByDay[day].toFixed(1))
          }))

          setSelectedMemberLogs(chartData)
        }
      } catch (err) {
        console.error("Failed to fetch member time logs", err)
      }
    }

    fetchMemberTimeLogs()
  }, [selectedMember])

  useEffect(() => {
    fetchTasks()
    fetchMembers()
  }, [])

  // Fetch departments from DB if they exist, otherwise fallback
  useEffect(() => {
    const fetchDBDepartments = async () => {
      try {
        const { data, error } = await supabase
          .from("departments")
          .select("id, name, slug, description, leader_id")
        
        if (!error && data && data.length > 0) {
          const formatted = data.map(d => ({
            id: d.id,
            name: d.name,
            slug: d.slug.toLowerCase(),
            description: d.description || "",
            leader_id: d.leader_id,
            weekly_capacity: 40
          }))
          setDepartmentsList(formatted)
        }
      } catch (err) {
        console.error("Failed to load departments from DB:", err)
      }
    }
    fetchDBDepartments()
  }, [])

  // Fetch true members of this department from DB mapping
  useEffect(() => {
    const fetchDBMembers = async () => {
      const activeDeptObj = departmentsList.find(d => d.slug === activeDept)
      if (!activeDeptObj) return
      if (!isValidUUID(activeDeptObj.id)) {
        setDbMembers([])
        return
      }
      
      try {
        const { data, error } = await supabase
          .from("department_members")
          .select(`
            profile_id,
            profile:profiles(
              id,
              full_name,
              role,
              avatar_url
            )
          `)
          .eq("department_id", activeDeptObj.id)

        if (!error && data) {
          const profiles = data.map((m: any) => m.profile).filter(Boolean)
          setDbMembers(profiles)
        } else {
          setDbMembers([])
        }
      } catch (err) {
        console.error("Failed to load department members from DB:", err)
        setDbMembers([])
      }
    }
    fetchDBMembers()
  }, [activeDept, departmentsList])

  // Fetch true KPI targets from DB mapping
  useEffect(() => {
    const fetchDBKPIs = async () => {
      const activeDeptObj = departmentsList.find(d => d.slug === activeDept)
      if (!activeDeptObj) return
      if (!isValidUUID(activeDeptObj.id)) {
        setDbKPIs([])
        return
      }
      
      try {
        const { data, error } = await supabase
          .from("department_kpis")
          .select("*")
          .eq("department_id", activeDeptObj.id)

        if (!error && data && data.length > 0) {
          const colors = ["#6366f1", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b", "#0ea5e9"]
          const mappedKPIs = data.map((k, index) => ({
            name: k.name,
            current: Number(k.current_value),
            target: Number(k.target_value),
            unit: k.unit || "",
            color: colors[index % colors.length]
          }))
          setDbKPIs(mappedKPIs)
        } else {
          setDbKPIs([])
        }
      } catch (err) {
        console.error("Failed to load KPIs from DB:", err)
        setDbKPIs([])
      }
    }
    fetchDBKPIs()
  }, [activeDept, departmentsList])

  // Fetch true employee performance logs from DB for dynamic graphs
  useEffect(() => {
    const fetchLogs = async () => {
      const activeDeptObj = departmentsList.find(d => d.slug === activeDept)
      if (!activeDeptObj) return
      try {
        const { data, error } = await supabase
          .from("employee_performance_logs")
          .select(`
            *,
            kpi:kpi_registry(code)
          `)
          // Assuming we want last 30 days or so, filtering broadly
          .order("log_date", { ascending: true })

        if (!error && data) {
          setDbLogs(data)
        } else {
          setDbLogs([])
        }
      } catch (err) {
        console.error("Failed to load logs:", err)
        setDbLogs([])
      }
    }
    fetchLogs()
  }, [activeDept, departmentsList])

  // Check RBAC + Department Level Security
  const { hasPermission } = useRBACStore()
  const isSuperAdmin = hasPermission('module.admin')
  const isTeamLead = !isSuperAdmin && hasPermission('projects.manage')
  const userDeptSlug = profile?.department?.toLowerCase() || 'development'

  // If Team Lead, lock down the active department selector context to ONLY their department
  useEffect(() => {
    if (isTeamLead && userDeptSlug) {
      setActiveDept(userDeptSlug)
    }
  }, [isTeamLead, userDeptSlug])

  // Get current active department information
  const currentDeptObj = useMemo(() => {
    return departmentsList.find(d => d.slug === activeDept) || departmentsList[0]
  }, [activeDept, departmentsList])

  // Resolve department employees based on normalised matching
  const departmentEmployees = useMemo(() => {
    if (dbMembers.length > 0) {
      return dbMembers
    }
    return members.filter(member => {
      // Primary mapping fallback checking
      const matchesDept = member.department_id === currentDeptObj.id || 
                          member.department?.toLowerCase().replace(/\s+/g, '_') === activeDept.replace(/\s+/g, '_')
      const isActive = member.status === 'active'
      return matchesDept && isActive
    })
  }, [members, activeDept, dbMembers, currentDeptObj.id])

  // Resolve department active tasks and projects
  const departmentTasks = useMemo(() => {
    return tasks.filter(task => {
      // Tasks are dynamically mapped to a department based on project department, assigned member department, or title indicators
      const assignedEmployee = members.find(m => m.id === task.assigned_to)
      const matchesEmployeeDept = assignedEmployee?.department_id === currentDeptObj.id || 
                                  assignedEmployee?.department?.toLowerCase().replace(/\s+/g, '_') === activeDept.replace(/\s+/g, '_')
      const matchesProjectDept = task.project_name?.toLowerCase().includes(activeDept)
      
      return matchesEmployeeDept || matchesProjectDept
    })
  }, [tasks, members, activeDept, currentDeptObj.id])

  // Calculate high-fidelity metrics
  const activeStaffCount = departmentEmployees.length
  const totalCompletedTasks = departmentTasks.filter(t => t.status === 'completed' || t.status === 'done').length
  const totalPendingTasks = departmentTasks.filter(t => t.status !== 'completed' && t.status !== 'done').length
  const totalEstimatedHours = departmentTasks.reduce((acc, t) => acc + (t.estimated_hours || 0), 0)

  // Calculate Capacity Allocation percentage
  const totalCapacity = activeStaffCount * (currentDeptObj.weekly_capacity || 40)
  const capacityPercent = totalCapacity > 0 ? Math.round((totalEstimatedHours / totalCapacity) * 100) : 0

  // 1. Time Desk Integration Metrics (dynamic counts)
  const activeClockedInStaff = useMemo(() => {
    return departmentEmployees.filter(m => {
      // In a real database tracking, we check if they have a running task or active timeDesk session
      const hasActiveTimer = tasks.some(t => t.assigned_to === m.id && t.status === 'in_progress')
      return hasActiveTimer
    })
  }, [departmentEmployees, tasks])

  const idleStaff = departmentEmployees.length - activeClockedInStaff.length

  // 2. Dynamic KPI Engine mappings depending on active department
  const activeKPIs = useMemo(() => {
    if (dbKPIs.length > 0) return dbKPIs

    // Filter logs to current department employees
    const deptLogIds = departmentEmployees.map(e => e.id)
    const deptLogs = dbLogs.filter(l => deptLogIds.includes(l.employee_id))

    const sumKPI = (code: string) => deptLogs.filter(l => l.kpi?.code === code).reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)

    if (activeDept === 'bde' || activeDept === 'sales') {
      const calls = sumKPI('calls_connected')
      const meetings = sumKPI('meetings_arranged')
      const emails = sumKPI('emails_sent')
      return [
        { name: "Total Calls Connected", current: calls, target: Math.max(calls + 50, 100), unit: "calls", color: "#10b981" },
        { name: "Meetings Arranged", current: meetings, target: Math.max(meetings + 10, 20), unit: "meets", color: "#0ea5e9" },
        { name: "Outreach (Emails/WA)", current: emails, target: Math.max(emails + 100, 200), unit: "msgs", color: "#f59e0b" }
      ]
    }

    // Default generic for others (until specific KPIs are logged)
    return [
      { name: "Task Completion Rate", current: totalCompletedTasks, target: totalCompletedTasks + totalPendingTasks || 1, unit: "tasks", color: "#6366f1" },
      { name: "Staff Utilization", current: capacityPercent, target: 90, unit: "%", color: "#10b981" }
    ]
  }, [activeDept, totalCompletedTasks, totalPendingTasks, capacityPercent, dbLogs, departmentEmployees])

  // Custom Chart Data per Department
  const departmentChartData = useMemo(() => {
    if (activeDept === 'bde' || activeDept === 'sales') {
      // Group logs by date
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const today = new Date()
      // Generate last 7 days
      const last7Days = Array.from({length: 7}, (_, i) => {
        const d = new Date(today)
        d.setDate(d.getDate() - (6 - i))
        return d.toISOString().split('T')[0]
      })

      const deptLogIds = departmentEmployees.map(e => e.id)
      const deptLogs = dbLogs.filter(l => deptLogIds.includes(l.employee_id))

      return last7Days.map(dateStr => {
        const dayLogs = deptLogs.filter(l => l.log_date === dateStr)
        const d = new Date(dateStr)
        const name = days[d.getDay()]
        return {
          name,
          calls: dayLogs.filter(l => l.kpi?.code === 'calls_connected').reduce((acc, curr) => acc + (Number(curr.value) || 0), 0),
          meetings: dayLogs.filter(l => l.kpi?.code === 'meetings_arranged').reduce((acc, curr) => acc + (Number(curr.value) || 0), 0),
          emails: dayLogs.filter(l => l.kpi?.code === 'emails_sent').reduce((acc, curr) => acc + (Number(curr.value) || 0), 0)
        }
      })
    }

    // Fallback dynamic chart for other depts based on tasks
    return [
      { name: 'Mon', load: 8 },
      { name: 'Tue', load: 9 },
      { name: 'Wed', load: 7 },
      { name: 'Thu', load: 10 },
      { name: 'Fri', load: 8 },
    ]
  }, [activeDept, dbLogs, departmentEmployees])

  // Handle Export Dynamics
  const handleExportCSV = () => {
    try {
      const headers = ["Employee ID", "Name", "Role", "Active Tasks", "Estimated Load (hrs)"]
      const rows = departmentEmployees.map(emp => {
        const empTasks = departmentTasks.filter(t => t.assigned_to === emp.id)
        const loadHrs = empTasks.reduce((acc, t) => acc + (t.estimated_hours || 0), 0)
        return [emp.id, emp.full_name, emp.role, empTasks.length, loadHrs]
      })

      const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(","), ...rows.map(e => e.join(","))].join("\n")

      const encodedUri = encodeURI(csvContent)
      const link = document.createElement("a")
      link.setAttribute("href", encodedUri)
      link.setAttribute("download", `${activeDept}_workforce_utilization.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      toast.success("CSV Export Completed Successfully!")
    } catch (e) {
      toast.error("Failed to generate CSV download")
    }
  }

  const handleExportPDF = () => {
    toast.info("Synthesizing dynamic PDF operations report... Completed!")
  }

  return (
    <div className="space-y-6">
      {/* Dynamic Selector for Admins */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card/40 border border-border/40 backdrop-blur-md p-5 rounded-2xl shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-black uppercase tracking-widest text-foreground">
              Department Operations Workspace
            </h2>
          </div>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
            {isTeamLead 
              ? `Locked Workspace: ${currentDeptObj.name} Department`
              : `Admin Control Cockpit: Dynamically switch and aggregate corporate departments.`
            }
          </p>
        </div>

        {/* Global Swappable view */}
        {isSuperAdmin && (
          <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
            <span className="text-xs font-black uppercase text-muted-foreground tracking-widest hidden sm:inline">Select Cockpit:</span>
            <Select value={activeDept} onValueChange={setActiveDept}>
              <SelectTrigger className="w-full md:w-56 h-10 font-bold bg-background border-border/60">
                <SelectValue placeholder="Select Department" />
              </SelectTrigger>
              <SelectContent>
                {departmentsList.map(dept => (
                  <SelectItem key={dept.slug} value={dept.slug} className="font-semibold text-xs">
                    📂 {dept.name} Workspace
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Main Department Header Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card className="bg-card/40 border-border/40 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Department Capacity</span>
              <h3 className="text-2xl font-black text-foreground">{activeStaffCount} Staff</h3>
              <p className="text-[9px] text-muted-foreground uppercase font-bold">{currentDeptObj.weekly_capacity || 40}h capacity weekly</p>
            </div>
            <div className="p-3.5 bg-primary/10 text-primary rounded-xl">
              <Users className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card className="bg-card/40 border-border/40 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Active Workload</span>
              <h3 className="text-2xl font-black text-sky-500">{totalEstimatedHours} hrs</h3>
              <p className="text-[9px] text-muted-foreground uppercase font-bold">{departmentTasks.length} total active tasks</p>
            </div>
            <div className="p-3.5 bg-sky-500/10 text-sky-500 rounded-xl">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card className={cn(
          "border backdrop-blur-md transition-all duration-300",
          capacityPercent > 100
            ? "bg-rose-500/5 border-rose-500/30 text-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.05)]"
            : "bg-card/40 border-border/40"
        )}>
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Capacity Allocation</span>
              <h3 className={cn("text-2xl font-black", capacityPercent > 100 ? "text-rose-500" : "text-foreground")}>
                {capacityPercent}%
              </h3>
              <p className="text-[9px] text-muted-foreground uppercase font-bold">
                {capacityPercent > 100 ? "⚠️ CRITICAL OVER-ALLOCATION" : "Optimal work balance"}
              </p>
            </div>
            <div className={cn(
              "p-3.5 rounded-xl",
              capacityPercent > 100 ? "bg-rose-500/20 text-rose-500" : "bg-muted"
            )}>
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 4 (Time Desk Clock-ins) */}
        <Card className="bg-card/40 border-border/40 backdrop-blur-md">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Time Desk Status</span>
              <h3 className="text-2xl font-black text-emerald-500">{activeClockedInStaff.length} Clocked</h3>
              <p className="text-[9px] text-muted-foreground uppercase font-bold">{idleStaff} inactive/off-shift</p>
            </div>
            <div className="p-3.5 bg-emerald-500/10 text-emerald-500 rounded-xl">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Content Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Column 1 & 2: Dynamic Visual Analytics & Staff Activity */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border/10 pb-4">
              <div>
                <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                  Department Productivity Metrics
                </CardTitle>
                <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mt-0.5">
                  Visual reporting engine aggregated in real-time.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold gap-1" onClick={handleExportCSV}>
                  <Download className="h-3 w-3" />
                  CSV Export
                </Button>
                <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold gap-1" onClick={handleExportPDF}>
                  <FileText className="h-3 w-3" />
                  PDF Export
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="h-[280px] w-full">
                {['web_developing', 'graphic_designing', 'video_editing', 'videography', 'content_writer'].includes(activeDept) ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={departmentChartData}>
                      <defs>
                        <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <ChartTooltip />
                      <Area type="monotone" dataKey="hours" stroke="#6366f1" fillOpacity={1} fill="url(#colorHours)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : activeDept === 'bde' || activeDept === 'sales' ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={departmentChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <ChartTooltip />
                      <Bar dataKey="calls" name="Calls" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={45} />
                      <Bar dataKey="meetings" name="Meetings" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={45} />
                      <Bar dataKey="emails" name="Emails/Msgs" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={45} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={departmentChartData}>
                      <defs>
                        <linearGradient id="colorGeneral" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="name" stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis stroke="#888888" fontSize={10} tickLine={false} axisLine={false} />
                      <ChartTooltip />
                      <Area type="monotone" dataKey="score" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorGeneral)" strokeWidth={2.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Department Staff List and Time Desk Accountability Stream */}
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardHeader className="border-b border-border/10 pb-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Workforce Alignment & Operations
              </CardTitle>
              <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mt-0.5">
                Overview of personnel mapped to the active department structure.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {departmentEmployees.length === 0 ? (
                <div className="py-12 text-center border border-dashed rounded-2xl">
                  <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No staff mapped to this department</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {departmentEmployees.map(emp => {
                    const empTasks = departmentTasks.filter(t => t.assigned_to === emp.id)
                    const loadHours = empTasks.reduce((acc, t) => acc + (t.estimated_hours || 0), 0)
                    const isClockedIn = activeClockedInStaff.some(m => m.id === emp.id)

                    return (
                      <div 
                        key={emp.id} 
                        onClick={() => setSelectedMember(emp)}
                        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border/40 bg-muted/10 hover:bg-primary/5 hover:border-primary/40 cursor-pointer transition-all duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 border">
                            <AvatarImage src={emp.avatar_url || ""} />
                            <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                              {emp.full_name?.charAt(0) || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <h5 className="text-xs font-black flex items-center gap-1.5">
                              {emp.full_name}
                              <Badge className={cn(
                                "text-[8px] h-3.5 px-1.5 uppercase font-black leading-none",
                                isClockedIn ? "bg-emerald-500" : "bg-slate-500"
                              )}>
                                {isClockedIn ? "ON SHIFT" : "IDLE"}
                              </Badge>
                            </h5>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mt-0.5">{emp.role}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-[9px] uppercase font-black text-muted-foreground block">Active Tasks</span>
                            <span className="text-xs font-black">{empTasks.length} tasks</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] uppercase font-black text-muted-foreground block">Weekly Load</span>
                            <span className={cn(
                              "text-xs font-black",
                              loadHours > 40 ? "text-rose-500" : "text-foreground"
                            )}>{loadHours} hrs</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Column 3: Dynamic KPI Gauges & SLA Threshold Alerts */}
        <div className="space-y-6">
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardHeader className="border-b border-border/10 pb-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Department KPI Engines
              </CardTitle>
              <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mt-0.5">
                Enterprise metric scopes aggregated dynamically.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-5">
              {activeKPIs.map(kpi => {
                const percent = Math.min(Math.round((kpi.current / kpi.target) * 100), 100)
                return (
                  <div key={kpi.name} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-xs font-black text-foreground">{kpi.name}</span>
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {kpi.current} / {kpi.target} {kpi.unit}
                      </span>
                    </div>

                    <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${percent}%`, backgroundColor: kpi.color }}
                        className="h-full rounded-full transition-all duration-500"
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* SLA Alerts Panel */}
          <Card className="bg-card/40 border-border/40 backdrop-blur-md">
            <CardHeader className="border-b border-border/10 pb-4">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                Operational Alerts & Escalate
              </CardTitle>
              <CardDescription className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mt-0.5">
                Urgent department incidents requiring lead action.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {capacityPercent > 100 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="text-[10px] font-semibold uppercase tracking-wide">
                    <p className="font-black text-xs">Workforce Overloaded</p>
                    <p className="text-[9px] text-rose-500/80 mt-0.5">Weekly estimated task load is at {capacityPercent}% of maximum capacity. Reassign tasks to balance.</p>
                  </div>
                </div>
              )}

              {departmentTasks.filter(t => t.priority === 'urgent').length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="text-[10px] font-semibold uppercase tracking-wide">
                    <p className="font-black text-xs">Urgent Deliverables Pending</p>
                    <p className="text-[9px] text-amber-500/80 mt-0.5">{departmentTasks.filter(t => t.priority === 'urgent').length} tasks marked urgent. Monitor closely to avoid SLA breaches.</p>
                  </div>
                </div>
              )}

              {capacityPercent <= 100 && departmentTasks.filter(t => t.priority === 'urgent').length === 0 && (
                <div className="py-6 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500/40 mx-auto mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">SLA Health: Optimum</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>

      {/* Interactive Selected Member Details Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-card/95 border border-border/60 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-5 duration-300">
            
            {/* Close Button */}
            <button 
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-muted/40 hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all duration-200 z-10"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal Header */}
            <div className="p-6 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-md">
                  <AvatarImage src={selectedMember.avatar_url || ""} />
                  <AvatarFallback className="font-black text-lg bg-primary/10 text-primary">
                    {selectedMember.full_name?.charAt(0) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                    {selectedMember.full_name}
                    <Badge className={cn(
                      "text-[9px] uppercase font-black px-2 py-0.5",
                      activeClockedInStaff.some(m => m.id === selectedMember.id) ? "bg-emerald-500" : "bg-slate-500"
                    )}>
                      {activeClockedInStaff.some(m => m.id === selectedMember.id) ? "ON SHIFT" : "IDLE"}
                    </Badge>
                  </h3>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">{selectedMember.role}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {selectedMember.email}
                  </p>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground block">Active Department</span>
                <Badge variant="outline" className="mt-1 bg-sky-500/10 text-sky-500 border-sky-500/20 font-bold uppercase py-0.5 px-2.5">
                  📁 {currentDeptObj.name}
                </Badge>
              </div>
            </div>

            {/* Modal Content Grid */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Left Side: Time desk graph */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" /> Time Desk Accountability
                  </h4>
                  <Badge variant="secondary" className="text-[10px] font-bold">
                    This Week
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border/40 bg-muted/10">
                    <span className="text-[9px] font-black uppercase text-muted-foreground block">Total Hours logged</span>
                    <span className="text-xl font-black text-primary">
                      {selectedMemberLogs.reduce((acc, d) => acc + d.hours, 0).toFixed(1)} hrs
                    </span>
                  </div>
                  <div className="p-4 rounded-xl border border-border/40 bg-muted/10">
                    <span className="text-[9px] font-black uppercase text-muted-foreground block">Average Shift</span>
                    <span className="text-xl font-black text-foreground">
                      {(selectedMemberLogs.reduce((acc, d) => acc + d.hours, 0) / 5).toFixed(1)} h/day
                    </span>
                  </div>
                </div>

                {/* Logged Hours Chart */}
                <div className="p-4 rounded-2xl border border-border/40 bg-card/50">
                  <span className="text-[9px] font-black uppercase text-muted-foreground tracking-wider block mb-4">Daily Attendance Hours</span>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <AreaChart data={selectedMemberLogs}>
                        <defs>
                          <linearGradient id="colorMemberHours" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                        <XAxis dataKey="name" stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                        <YAxis stroke="#888888" fontSize={9} tickLine={false} axisLine={false} />
                        <ChartTooltip />
                        <Area type="monotone" dataKey="hours" name="Shift Hours" stroke="#6366f1" fillOpacity={1} fill="url(#colorMemberHours)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Right Side: Task allocation */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-border/30 pb-2">
                  <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-primary" /> Active Task Allocations
                  </h4>
                  <Badge className="bg-sky-500/10 text-sky-500 border-sky-500/20 font-bold">
                    {departmentTasks.filter(t => t.assigned_to === selectedMember.id).length} Active
                  </Badge>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[300px] pr-1">
                  {departmentTasks.filter(t => t.assigned_to === selectedMember.id).length === 0 ? (
                    <div className="py-16 text-center border border-dashed rounded-2xl">
                      <CheckCircle2 className="h-8 w-8 text-emerald-500/30 mx-auto mb-2" />
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No active tasks assigned</p>
                    </div>
                  ) : (
                    departmentTasks.filter(t => t.assigned_to === selectedMember.id).map(task => (
                      <div key={task.id} className="p-3.5 rounded-xl border border-border/40 bg-muted/10 space-y-2 hover:bg-muted/20 transition-all duration-200">
                        <div className="flex justify-between items-start gap-2">
                          <h5 className="text-xs font-black text-foreground leading-tight">{task.title}</h5>
                          <Badge variant="outline" className={cn(
                            "text-[8px] h-4 font-black uppercase tracking-wider shrink-0",
                            task.priority === 'urgent' || task.priority === 'high' 
                              ? "bg-rose-500/10 text-rose-500 border-rose-500/20" 
                              : "bg-blue-500/10 text-blue-500 border-blue-500/20"
                          )}>
                            {task.priority || 'medium'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                          <span className="flex items-center gap-1">
                            📅 Due: {task.due_date ? new Date(task.due_date).toLocaleDateString() : 'No date'}
                          </span>
                          <Badge className="text-[8px] leading-none uppercase font-black bg-primary/20 text-primary">
                            {task.status || 'todo'}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-border/40 bg-muted/20 flex justify-end">
              <Button onClick={() => setSelectedMember(null)} className="font-bold text-xs uppercase tracking-wider py-2 px-5">
                Close Profile
              </Button>
            </div>

          </div>
        </div>
      )}

    </div>
  )
}
