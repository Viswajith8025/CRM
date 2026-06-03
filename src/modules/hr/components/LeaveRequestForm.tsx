import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"

interface LeaveType {
  id: string
  name: string
}

interface LeaveRequestFormProps {
  onSuccess?: () => void
}

export function LeaveRequestForm({ onSuccess }: LeaveRequestFormProps) {
  const [loading, setLoading] = useState(false)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [formData, setFormData] = useState({
    leave_type_id: '',
    start_date: '',
    end_date: '',
    reason: '',
    is_emergency: false
  })

  useEffect(() => {
    // Fetch real leave type UUIDs from the database
    supabase
      .from('leave_types')
      .select('id, name')
      .eq('is_active', true)
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Deduplicate by name (take first occurrence)
          const seen = new Set<string>()
          const unique = data.filter(t => {
            if (seen.has(t.name)) return false
            seen.add(t.name)
            return true
          })
          setLeaveTypes(unique)
          setFormData(prev => ({ ...prev, leave_type_id: unique[0].id }))
        }
      })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.leave_type_id || !formData.start_date || !formData.end_date || !formData.reason) {
      toast.error("Please fill in all required fields")
      return
    }
    if (formData.reason.length < 5) {
      toast.error("Please provide a reason (min 5 characters)")
      return
    }

    setLoading(true)
    try {
      // Get the current user's session for the insert
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('You must be logged in to submit a leave request.')

      // Get the user's profile to find their organization_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('id', user.id)
        .single()

      if (!profile?.organization_id) throw new Error('Could not find your organization. Please contact your admin.')

      // Use RPC to bypass PostgREST schema cache issues
      const { data: insertData, error } = await supabase.rpc('submit_leave_request', {
        p_leave_type_id: formData.leave_type_id,
        p_start_date: formData.start_date,
        p_end_date: formData.end_date,
        p_reason: formData.reason,
        p_is_emergency: formData.is_emergency
      })

      console.log("RPC RESULT:", { error, data: insertData })
      if (error) throw error

      toast.success("Leave request submitted successfully")
      onSuccess?.()
    } catch (error: any) {
      console.error('Leave submission error:', JSON.stringify(error))
      toast.error(error?.message || error?.details || "Failed to submit leave request", {
        description: error?.hint || error?.code || undefined
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">

      <div className="bg-primary/5 border border-primary/20 p-4 rounded-lg text-xs text-muted-foreground space-y-1 mb-4">
        <p className="font-bold text-foreground uppercase tracking-tight">Leave Policy Overview</p>
        <ul className="list-disc pl-4 space-y-1 mt-2">
          <li><strong>Paid Leave:</strong> Requires 14 days prior notice.</li>
          <li><strong>Sick Leave:</strong> Exceeding 2 days requires a medical certificate upon return.</li>
          <li><strong>Casual Leave:</strong> Maximum 3 consecutive days.</li>
          <li><strong>Unpaid Leave:</strong> Subject to management approval based on current workload.</li>
        </ul>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-widest">Leave Type</Label>
        <Select
          value={formData.leave_type_id}
          onValueChange={(val) => setFormData(prev => ({ ...prev, leave_type_id: val }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select leave type" />
          </SelectTrigger>
          <SelectContent>
            {leaveTypes.map(type => (
              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 flex flex-col">
          <Label className="text-xs font-bold uppercase tracking-widest">Start Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("w-full pl-3 text-left font-normal h-10", !formData.start_date && "text-muted-foreground")}
              >
                {formData.start_date ? format(new Date(formData.start_date), "dd/MM/yyyy") : <span>Pick a date</span>}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.start_date ? new Date(formData.start_date) : undefined}
                onSelect={(date) => setFormData(prev => ({ ...prev, start_date: date ? format(date, 'yyyy-MM-dd') : '' }))}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2 flex flex-col">
          <Label className="text-xs font-bold uppercase tracking-widest">End Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn("w-full pl-3 text-left font-normal h-10", !formData.end_date && "text-muted-foreground")}
              >
                {formData.end_date ? format(new Date(formData.end_date), "dd/MM/yyyy") : <span>Pick a date</span>}
                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={formData.end_date ? new Date(formData.end_date) : undefined}
                onSelect={(date) => setFormData(prev => ({ ...prev, end_date: date ? format(date, 'yyyy-MM-dd') : '' }))}
                disabled={(date) => {
                  const min = formData.start_date ? new Date(formData.start_date) : new Date(new Date().setHours(0, 0, 0, 0))
                  return date < min
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-widest">Reason</Label>
        <Textarea
          placeholder="Explain your reason for leave..."
          value={formData.reason}
          onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
        />
      </div>

      <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl">
        <input
          type="checkbox"
          id="is_emergency"
          className="h-4 w-4 accent-rose-500"
          checked={formData.is_emergency}
          onChange={(e) => setFormData(prev => ({ ...prev, is_emergency: e.target.checked }))}
        />
        <Label htmlFor="is_emergency" className="text-xs font-bold text-rose-700 uppercase cursor-pointer">
          This is an Emergency Leave
        </Label>
      </div>

      <Button type="submit" className="w-full font-bold" disabled={loading}>
        {loading ? "Submitting..." : "Submit Leave Request"}
      </Button>
    </form>
  )
}
