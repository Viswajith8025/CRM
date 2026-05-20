
import { useEffect, useState } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { useRenewalStore, type Renewal } from "../renewalStore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { 
  Plus, 
  Search, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Mail, 
  Server, 
  Globe, 
  ShieldCheck,
  MoreHorizontal,
  Trash2,
  Bell,
  CheckCircle
} from "lucide-react"
import { format, isBefore, addDays, isAfter } from "date-fns"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { RenewalForm } from "../components/RenewalForm"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export default function RenewalsPage() {
  const { renewals, isLoading, fetchRenewals, sendReminder, deleteRenewal, updateRenewal } = useRenewalStore()
  const [search, setSearch] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [selectedRenewal, setSelectedRenewal] = useState<Renewal | undefined>()

  useEffect(() => {
    fetchRenewals()
  }, [])

  const filteredRenewals = renewals.filter(r => 
    r.client?.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.description?.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  )

  const getStatusBadge = (renewal: Renewal) => {
    const isOverdue = isBefore(new Date(renewal.expiry_date), new Date()) && renewal.status !== 'paid'
    const isExpiringSoon = isBefore(new Date(renewal.expiry_date), addDays(new Date(), 30)) && !isOverdue && renewal.status !== 'paid'

    if (renewal.status === 'paid') return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 uppercase font-black text-[10px]"><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</Badge>
    if (isOverdue) return <Badge variant="destructive" className="uppercase font-black text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" /> Overdue</Badge>
    if (isExpiringSoon) return <Badge variant="secondary" className="bg-amber-500/10 text-amber-500 border-amber-500/20 uppercase font-black text-[10px]"><Clock className="h-3 w-3 mr-1" /> Expiring Soon</Badge>
    
    return <Badge variant="outline" className="uppercase font-black text-[10px]">{renewal.status}</Badge>
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'hosting': return <Server className="h-4 w-4" />
      case 'domain': return <Globe className="h-4 w-4" />
      case 'mail': return <Mail className="h-4 w-4" />
      case 'hosting_domain': return <ShieldCheck className="h-4 w-4" />
      default: return <Server className="h-4 w-4" />
    }
  }

  const upcomingCount = renewals.filter(r => 
    r.status !== 'paid' && isBefore(new Date(r.expiry_date), addDays(new Date(), 30))
  ).length

  return (
    <PageWrapper 
      title="Asset Renewals" 
      description="Track and manage recurring service renewals for project hosting, domains, and enterprise mail systems."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <Card className="bg-card/30 border-border/50 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Total Renewals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black tracking-tighter">{renewals.length}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Active recurring services</p>
          </CardContent>
        </Card>

        <Card className="bg-card/30 border-border/50 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-amber-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Critical Window
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black tracking-tighter text-amber-500">{upcomingCount}</p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Expiring within 30 days</p>
          </CardContent>
        </Card>

        <Card className="bg-card/30 border-border/50 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Revenue Locked
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-black tracking-tighter text-emerald-500">
              ${renewals.filter(r => r.status === 'paid').reduce((sum, r) => sum + Number(r.amount || 0), 0).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground font-medium mt-1">Current period collection</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between mt-8">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by client, domain or category..." 
            className="pl-10 bg-card/50 border-border/50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button 
          onClick={() => { setSelectedRenewal(undefined); setIsFormOpen(true); }}
          className="w-full md:w-auto font-black uppercase tracking-widest text-xs gap-2"
        >
          <Plus className="h-4 w-4" /> Schedule Renewal
        </Button>
      </div>

      <div className="mt-6 rounded-2xl border border-border/50 bg-card/30 overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-border/50">
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Service / Client</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Category</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Expiry Date</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Amount</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4">Status</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium">Loading renewal matrix...</TableCell></TableRow>
            ) : filteredRenewals.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-20 text-muted-foreground font-medium">No renewals found.</TableCell></TableRow>
            ) : (
              filteredRenewals.map((renewal) => (
                <TableRow key={renewal.id} className="hover:bg-primary/5 border-border/50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{renewal.description || 'System Renewal'}</span>
                      <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-tight">
                        {renewal.client?.name || 'External Client'} {renewal.project?.name && `• ${renewal.project.name}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {getCategoryIcon(renewal.category)}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest">{renewal.category.replace('_', ' & ')}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold">{format(new Date(renewal.expiry_date), 'MMM d, yyyy')}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {isBefore(new Date(renewal.expiry_date), new Date()) ? 'Expired' : `${Math.ceil((new Date(renewal.expiry_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-black text-sm">${Number(renewal.amount || 0).toLocaleString()}</TableCell>
                  <TableCell>{getStatusBadge(renewal)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem onClick={() => { setSelectedRenewal(renewal); setIsFormOpen(true); }} className="gap-2 cursor-pointer font-bold text-xs uppercase">
                          <Plus className="h-3.5 w-3.5" /> Edit Record
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => sendReminder(renewal)} className="gap-2 cursor-pointer font-bold text-xs uppercase text-primary">
                          <Bell className="h-3.5 w-3.5" /> Send Reminder
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => updateRenewal(renewal.id, { status: 'paid' })} className="gap-2 cursor-pointer font-bold text-xs uppercase text-emerald-500">
                          <CheckCircle className="h-3.5 w-3.5" /> Mark as Paid
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteRenewal(renewal.id)} className="gap-2 cursor-pointer font-bold text-xs uppercase text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" /> Delete Entry
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black uppercase tracking-tighter">
              {selectedRenewal ? 'Edit Renewal' : 'Schedule New Renewal'}
            </DialogTitle>
            <DialogDescription className="font-medium">
              Configure renewal tracking for hosting, domains, or enterprise mail services.
            </DialogDescription>
          </DialogHeader>
          <RenewalForm 
            onSuccess={() => { setIsFormOpen(false); fetchRenewals(); }}
            initialData={selectedRenewal}
          />
        </DialogContent>
      </Dialog>
    </PageWrapper>
  )
}
