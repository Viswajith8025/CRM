import { 
  Briefcase, 
  AlertCircle, 
  DollarSign, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  MoreVertical,
  Plus
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'

const stats = [
  { 
    name: 'Active Projects', 
    value: '12', 
    change: '+2', 
    changeType: 'increase', 
    icon: Briefcase,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  { 
    name: 'Overdue Tasks', 
    value: '3', 
    change: '-1', 
    changeType: 'decrease', 
    icon: AlertCircle,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10'
  },
  { 
    name: 'Revenue (MTD)', 
    value: '$24,500', 
    change: '+18.2%', 
    changeType: 'increase', 
    icon: DollarSign,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  },
  { 
    name: 'Team Utilization', 
    value: '84%', 
    change: '+4%', 
    changeType: 'increase', 
    icon: Users,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10'
  },
]

const chartData = [
  { name: 'Mon', revenue: 4000, target: 2400 },
  { name: 'Tue', revenue: 3000, target: 1398 },
  { name: 'Wed', revenue: 2000, target: 9800 },
  { name: 'Thu', revenue: 2780, target: 3908 },
  { name: 'Fri', revenue: 1890, target: 4800 },
  { name: 'Sat', revenue: 2390, target: 3800 },
  { name: 'Sun', revenue: 3490, target: 4300 },
]

const recentActivity = [
  { id: 1, user: 'John Doe', action: 'completed task', target: 'Fix Login Bug', time: '2 hours ago' },
  { id: 2, user: 'Sarah Smith', action: 'created project', target: 'Mobile App V2', time: '4 hours ago' },
  { id: 3, user: 'Mike Ross', action: 'added comment', target: 'API Integration', time: 'Yesterday' },
]

const upcomingDeadlines = [
  { id: 1, task: 'Database Migration', project: 'Cloud ERP', date: 'Oct 24', status: 'high' },
  { id: 2, task: 'Client Presentation', project: 'SaaS App', date: 'Oct 25', status: 'medium' },
  { id: 3, task: 'Final QA', project: 'Internal Tool', date: 'Oct 26', status: 'low' },
]

export default function Dashboard() {
  return (
    <PageWrapper 
      title="Dashboard" 
      description="Real-time overview of your IT service operations."
      actions={
        <Button className="gap-2 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" />
          Create New
        </Button>
      }
    >
      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name} className="group overflow-hidden transition-all duration-300 hover:shadow-premium-hover hover:-translate-y-1 border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className={cn(stat.bg, "p-3 rounded-xl transition-transform group-hover:scale-110")}>
                  <stat.icon className={cn("h-6 w-6", stat.color)} />
                </div>
                <div className={cn(
                  "flex items-center text-xs font-black px-2 py-1 rounded-full",
                  stat.changeType === 'increase' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                )}>
                  {stat.change}
                  {stat.changeType === 'increase' ? (
                    <ArrowUpRight className="ml-1 h-3 w-3" />
                  ) : (
                    <ArrowDownRight className="ml-1 h-3 w-3" />
                  )}
                </div>
              </div>
              <div className="mt-5">
                <p className="text-sm font-black text-muted-foreground uppercase tracking-wider">{stat.name}</p>
                <h3 className="text-3xl font-black tracking-tighter mt-1">{stat.value}</h3>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-7">
        {/* Revenue Chart */}
        <Card className="lg:col-span-4 border-border/50">
          <CardHeader>
            <CardTitle>Revenue Overview</CardTitle>
            <CardDescription>Daily revenue vs target for the current week.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    borderColor: 'hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-3 border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4">
                  <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      <span className="font-bold text-foreground">{activity.user}</span>{' '}
                      <span className="text-muted-foreground">{activity.action}</span>{' '}
                      <span className="text-primary">{activity.target}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Deadlines */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {upcomingDeadlines.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border/40 hover:bg-accent/30 transition-colors">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{item.task}</p>
                    <p className="text-xs text-muted-foreground">{item.project}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-mono">{item.date}</p>
                    <div className={`h-2 w-2 rounded-full ${
                      item.status === 'high' ? 'bg-rose-500' : 
                      item.status === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Invoice Status */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Invoice Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Paid (Current Month)</span>
                <span className="text-sm font-bold text-emerald-500">$18,450.00</span>
              </div>
              <div className="w-full bg-accent rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '75%' }}></div>
              </div>
              <div className="flex items-center justify-between pt-4">
                <span className="text-sm text-muted-foreground">Outstanding</span>
                <span className="text-sm font-bold text-rose-500">$6,050.00</span>
              </div>
              <div className="w-full bg-accent rounded-full h-2">
                <div className="bg-rose-500 h-2 rounded-full" style={{ width: '25%' }}></div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  )
}
