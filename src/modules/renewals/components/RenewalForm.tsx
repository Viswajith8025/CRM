import { useState, useEffect } from "react"
import { useRenewalStore, type Renewal, type RenewalCategory, type RenewalStatus } from "../renewalStore"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

interface RenewalFormProps {
  onSuccess: () => void
  initialData?: Renewal
}

export function RenewalForm({ onSuccess, initialData }: RenewalFormProps) {
  const { addRenewal, updateRenewal } = useRenewalStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [clients, setClients] = useState<any[]>([])
  const [projects, setProjects] = useState<any[]>([])
  const [isLoadingData, setIsLoadingData] = useState(true)

  const [formData, setFormData] = useState({
    client_id: initialData?.client_id || "",
    project_id: initialData?.project_id || "",
    category: initialData?.category || "hosting" as RenewalCategory,
    description: initialData?.description || "",
    amount: initialData?.amount || 0,
    expiry_date: initialData?.expiry_date || new Date().toISOString().split('T')[0],
    status: initialData?.status || "pending"
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsRes, projectsRes] = await Promise.all([
          supabase.from('clients').select('id, name, lead_id, leads(status)'),
          supabase.from('projects').select('id, name, client_id, status')
        ])
        
        // Filter to only active clients (where lead status is active_client, or no lead exists but is a client)
        const activeClients = (clientsRes.data || []).filter(c => {
          if (c.leads && Array.isArray(c.leads)) return c.leads[0]?.status === 'active_client';
          if (c.leads) return (c.leads as any).status === 'active_client';
          return true; // If no lead is attached, assume active
        })
        
        setClients(activeClients)
        setProjects(projectsRes.data || [])
      } catch (error) {
        console.error('Failed to load form data', error)
      } finally {
        setIsLoadingData(false)
      }
    }
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.client_id) {
      toast.error('Please select a client')
      return
    }

    setIsSubmitting(true)
    try {
      if (initialData) {
        await updateRenewal(initialData.id, formData)
      } else {
        await addRenewal(formData)
      }
      onSuccess()
    } catch (error) {
      console.error(error)
    } finally {
      setIsSubmitting(true)
    }
  }

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">Client Selection</Label>
          <Select 
            value={formData.client_id} 
            onValueChange={(val) => setFormData({ ...formData, client_id: val })}
          >
            <SelectTrigger className="bg-muted/30 border-border/50">
              <SelectValue placeholder="Select Client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">Associated Project (Optional)</Label>
          <Select 
            value={formData.project_id || "none"} 
            onValueChange={(val) => setFormData({ ...formData, project_id: val === "none" ? "" : val })}
          >
            <SelectTrigger className="bg-muted/30 border-border/50">
              <SelectValue placeholder="Select Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Independent Service</SelectItem>
              {projects
                .filter(p => p.status !== 'completed' && p.status !== 'cancelled' && p.status !== 'archived')
                .filter(p => !formData.client_id || p.client_id === formData.client_id)
                .map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">Service Category</Label>
          <Select 
            value={formData.category} 
            onValueChange={(val: RenewalCategory) => setFormData({ ...formData, category: val })}
          >
            <SelectTrigger className="bg-muted/30 border-border/50 uppercase font-bold text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hosting">Hosting</SelectItem>
              <SelectItem value="domain">Domain</SelectItem>
              <SelectItem value="mail">Mail Hosting</SelectItem>
              <SelectItem value="hosting_domain">Hosting & Domain</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">Expiration Date</Label>
          <Input 
            type="date" 
            className="bg-muted/30 border-border/50"
            value={formData.expiry_date}
            onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">Renewal Amount ($)</Label>
          <Input 
            type="number" 
            step="0.01"
            className="bg-muted/30 border-border/50 font-black"
            value={formData.amount || ""}
            onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-black uppercase tracking-widest">Status</Label>
          <Select 
            value={formData.status} 
            onValueChange={(val: any) => setFormData({ ...formData, status: val })}
          >
            <SelectTrigger className="bg-muted/30 border-border/50 uppercase font-bold text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Reminder Sent</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-[10px] font-black uppercase tracking-widest">Description / Service Details</Label>
        <Textarea 
          placeholder="e.g. AWS Production Hosting, Google Workspace Business Starter..."
          className="bg-muted/30 border-border/50 min-h-[100px]"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <Button 
        type="submit" 
        className="w-full font-black uppercase tracking-widest py-6"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          initialData ? 'Update Renewal Schedule' : 'Schedule Renewal'
        )}
      </Button>
    </form>
  )
}
