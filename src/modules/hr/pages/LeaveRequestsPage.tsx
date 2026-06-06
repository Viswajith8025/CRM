import { useEffect, useState, useCallback, useRef } from "react"
import { PageWrapper } from "@/components/shared/PageWrapper"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { format, differenceInDays, parseISO } from "date-fns"
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,

  Loader2,
  AlertCircle,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { submitLeaveRequest } from "@/lib/leaveService"

// ─── Types ────────────────────────────────────────────────────────────────────

interface LeaveType {
  id: string
  name: string
  icon: string
  color: string
  description?: string
  policies?: {
    yearly_limit: number
    approval_required: boolean
  }[]
}

interface LeaveRequest {
  id: string
  start_date: string
  end_date: string
  reason: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  is_emergency: boolean
  leave_type: LeaveType
  created_at: string
  actions?: {
    id: string
    action: string
    note: string | null
    created_at: string
    actor?: { full_name: string }
  }[]
}

type FormState = {
  leave_type_id: string
  start_date: string
  end_date: string
  reason: string
  is_emergency: boolean
}

const EMPTY_FORM: FormState = {
  leave_type_id: "",
  start_date: "",
  end_date: "",
  reason: "",
  is_emergency: false,
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LeaveRequestsPage() {
  const { profile } = useAuthStore()

  const [requests, setRequests]         = useState<LeaveRequest[]>([])
  const [leaveTypes, setLeaveTypes]     = useState<LeaveType[]>([])
  const [isLoading, setIsLoading]       = useState(true)
  const [isFormOpen, setIsFormOpen]     = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData]         = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError]       = useState<string | null>(null)

  // Prevent double-tap on submit
  const submittingRef = useRef(false)

  // ─── Data Fetch ─────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!profile?.organization_id || !profile?.id) return
    setIsLoading(true)
    try {
      const [typesRes, reqsRes] = await Promise.all([
        supabase
          .from("leave_types")
          .select("*, policies:leave_policies(yearly_limit, approval_required)")
          .eq("is_active", true),
        supabase
          .from("leave_requests")
          .select(`
            *,
            leave_type:leave_types(*),
            actions:leave_request_actions(
              id, action, note, created_at,
              actor:profiles!leave_request_actions_actor_id_fkey(full_name)
            )
          `)
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false }),
      ])

      if (typesRes.data) {
        setLeaveTypes(
          typesRes.data.filter(
            (t) =>
              !["Casual Leave", "casual", "Casual"].includes(t.name ?? "")
          )
        )
      }

      if (reqsRes.error) throw reqsRes.error
      setRequests(reqsRes.data ?? [])
    } catch (err) {
      console.error("fetchData error:", err)
      toast.error("Failed to load leave data. Please refresh.")
    } finally {
      setIsLoading(false)
    }
  }, [profile?.id, profile?.organization_id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function closeForm() {
    setIsFormOpen(false)
    setFormData(EMPTY_FORM)
    setFormError(null)
  }



  // ─── Validation ──────────────────────────────────────────────────────────────

  function validateForm(): string | null {
    if (!formData.leave_type_id)
      return "Please select a leave type."
    if (!formData.start_date)
      return "Please select a start date."
    if (!formData.end_date)
      return "Please select an end date."
    if (new Date(formData.end_date) < new Date(formData.start_date))
      return "End date cannot be before the start date."
    if (!formData.reason.trim() || formData.reason.trim().length < 5)
      return "Please provide a reason (at least 5 characters)."
    return null
  }

  // ─── Submit ───────────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Double-submission guard
    if (submittingRef.current) return
    submittingRef.current = true

    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      submittingRef.current = false
      return
    }
    setFormError(null)
    setIsSubmitting(true)

    try {
        // ── New submission path ────────────────────────────────────────────
        const result = await submitLeaveRequest({
          leave_type_id: formData.leave_type_id,
          start_date:    formData.start_date,
          end_date:      formData.end_date,
          reason:        formData.reason,
          is_emergency:  formData.is_emergency,
        })

        if (!result.success) {
          setFormError(result.error ?? "Failed to submit.")
          return
        }
        toast.success("Leave request submitted successfully!")

      closeForm()
      fetchData() // Refresh the list dynamically
    } catch (err: any) {
      setFormError(err?.message ?? "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
      submittingRef.current = false
    }
  }

  // ─── Cancel ───────────────────────────────────────────────────────────────────

  const handleCancel = async (requestId: string) => {
    if (!profile?.id) return
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({ status: "cancelled" })
        .eq("id", requestId)
        .eq("user_id", profile.id) // RLS safety

      if (error) throw error
      toast.success("Request cancelled.")
      // Optimistic update
      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: "cancelled" } : r))
      )
    } catch {
      toast.error("Failed to cancel request. Please try again.")
    }
  }

  // ─── UI Helpers ──────────────────────────────────────────────────────────────

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 font-black uppercase text-[10px]">Approved</Badge>
      case "rejected":
        return <Badge variant="destructive" className="font-black uppercase text-[10px]">Rejected</Badge>
      case "pending":
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 font-black uppercase text-[10px]">Pending</Badge>
      case "cancelled":
        return <Badge variant="outline" className="text-slate-400 border-slate-200 bg-slate-50 font-black uppercase text-[10px]">Cancelled</Badge>

      default:
        return <Badge variant="outline" className="font-black uppercase text-[10px]">{status}</Badge>
    }
  }

  const isFormValid =
    !!formData.leave_type_id &&
    !!formData.start_date &&
    !!formData.end_date &&
    formData.reason.trim().length >= 5 &&
    new Date(formData.end_date) >= new Date(formData.start_date)

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageWrapper
      title="Leave Requests"
      description="Manage your time off, track approvals, and view leave balances."
    >
      <div className="space-y-6">

        {/* ── Header / Trigger ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/40 p-5 sm:p-6 rounded-2xl border border-border/40 backdrop-blur-md">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center">
              <CalendarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-widest text-xs sm:text-sm">Submit New Request</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-medium">Plan your time off in advance.</p>
            </div>
          </div>

          <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) closeForm(); else setIsFormOpen(true) }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto gap-2 rounded-xl h-11 px-5 font-black uppercase tracking-widest text-xs">
                <Plus className="h-4 w-4" /> Apply for Leave
              </Button>
            </DialogTrigger>

            <DialogContent className="w-[95vw] max-w-lg rounded-2xl p-5 sm:p-6 overflow-y-auto max-h-[92dvh]">
              <DialogHeader>
                <DialogTitle className="uppercase font-black tracking-widest text-sm">
                  Apply for Leave
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Fill in all fields to submit a leave request.
                </DialogDescription>
              </DialogHeader>

              {/* Policy notice */}
              <div className="bg-primary/5 p-3 sm:p-4 rounded-xl border border-primary/10 mt-2">
                <h4 className="text-[10px] font-black uppercase text-primary tracking-widest mb-2">Leave Policy Overview</h4>
                <ul className="text-xs text-foreground space-y-1.5 font-medium leading-relaxed list-none">
                  <li><strong className="text-primary">Paid Leave:</strong> Requires 2 days prior notice.</li>
                  <li><strong className="text-primary">Sick Leave:</strong> Exceeding 2 days requires a medical certificate.</li>
                  <li><strong className="text-primary">Unpaid Leave:</strong> Subject to management approval.</li>
                </ul>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4 mt-4" noValidate>
                {/* Inline error banner */}
                {formError && (
                  <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl">
                    <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-rose-700">{formError}</p>
                  </div>
                )}

                {/* Leave Type */}
                <div className="space-y-1.5">
                  <Label className="uppercase text-[10px] font-black tracking-widest">Leave Type</Label>
                  <Select
                    value={formData.leave_type_id}
                    onValueChange={(val) => {
                      setFormData((prev) => ({ ...prev, leave_type_id: val }))
                      setFormError(null)
                    }}
                  >
                    <SelectTrigger className="h-11 text-sm">
                      <SelectValue placeholder="Select leave type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.length === 0 ? (
                        <SelectItem value="_none" disabled>No leave types configured</SelectItem>
                      ) : (
                        leaveTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Pickers */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Start Date */}
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="uppercase text-[10px] font-black tracking-widest">Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-11 pl-3 text-left font-normal text-xs sm:text-sm",
                            !formData.start_date && "text-muted-foreground"
                          )}
                        >
                          {formData.start_date
                            ? format(parseISO(formData.start_date), "dd/MM/yyyy")
                            : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.start_date ? parseISO(formData.start_date) : undefined}
                          onSelect={(date) => {
                            const val = date ? format(date, "yyyy-MM-dd") : ""
                            setFormData((prev) => ({
                              ...prev,
                              start_date: val,
                              // Reset end_date if it's now before the new start
                              end_date: prev.end_date && new Date(prev.end_date) < new Date(val) ? "" : prev.end_date,
                            }))
                            setFormError(null)
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* End Date */}
                  <div className="space-y-1.5 flex flex-col">
                    <Label className="uppercase text-[10px] font-black tracking-widest">End Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full h-11 pl-3 text-left font-normal text-xs sm:text-sm",
                            !formData.end_date && "text-muted-foreground"
                          )}
                        >
                          {formData.end_date
                            ? format(parseISO(formData.end_date), "dd/MM/yyyy")
                            : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={formData.end_date ? parseISO(formData.end_date) : undefined}
                          onSelect={(date) => {
                            setFormData((prev) => ({
                              ...prev,
                              end_date: date ? format(date, "yyyy-MM-dd") : "",
                            }))
                            setFormError(null)
                          }}
                          disabled={(date) => {
                            const min = formData.start_date
                              ? parseISO(formData.start_date)
                              : new Date(new Date().setHours(0, 0, 0, 0))
                            return date < min
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-1.5">
                  <Label className="uppercase text-[10px] font-black tracking-widest">Reason for Leave</Label>
                  <Textarea
                    placeholder="Describe why you need time off... (min 5 characters)"
                    value={formData.reason}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, reason: e.target.value }))
                      setFormError(null)
                    }}
                    className="min-h-[90px] text-sm resize-none"
                    maxLength={1000}
                  />
                  <p className="text-[10px] text-muted-foreground text-right">
                    {formData.reason.length}/1000
                  </p>
                </div>

                {/* Emergency Checkbox */}
                <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-100 rounded-xl cursor-pointer"
                  onClick={() => setFormData((prev) => ({ ...prev, is_emergency: !prev.is_emergency }))}>
                  <input
                    type="checkbox"
                    id="emergency"
                    className="h-4 w-4 accent-rose-500 shrink-0"
                    checked={formData.is_emergency}
                    onChange={(e) => setFormData((prev) => ({ ...prev, is_emergency: e.target.checked }))}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Label htmlFor="emergency" className="text-xs font-bold text-rose-700 uppercase cursor-pointer">
                    This is an Emergency Leave
                  </Label>
                </div>

                {/* Footer */}
                <DialogFooter className="flex-col sm:flex-row gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeForm}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto rounded-xl font-bold uppercase text-xs h-11"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || !isFormValid}
                    className="w-full sm:w-auto rounded-xl font-bold uppercase text-xs h-11 gap-2"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Submitting...</>
                    ) : (
                      "Submit Request"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ── Leave History ────────────────────────────────────────────────── */}
        <div className="grid gap-4">
          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
            <Clock className="h-3 w-3" /> Leave History
          </h4>

          {isLoading ? (
            <div className="flex items-center justify-center p-12 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-xs font-black uppercase tracking-widest">Loading history...</span>
            </div>
          ) : requests.length === 0 ? (
            <Card className="bg-card/40 border-border/40 p-10 sm:p-12 text-center">
              <CalendarIcon className="h-10 w-10 sm:h-12 sm:w-12 mx-auto opacity-10 mb-4" />
              <p className="text-xs sm:text-sm font-bold text-muted-foreground uppercase tracking-widest">
                No leave requests found
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {requests.map((req) => {
                const days = differenceInDays(parseISO(req.end_date), parseISO(req.start_date)) + 1


                return (
                  <Card
                    key={req.id}
                    className={cn(
                      "bg-card/40 border-border/40 hover:border-primary/50 transition-all backdrop-blur-md relative overflow-hidden",
                      req.status === "cancelled" && "opacity-60"
                    )}
                  >
                    {req.is_emergency && (
                      <div className="absolute top-0 right-0 p-2">
                        <Badge className="bg-rose-500 font-black uppercase text-[8px] animate-pulse">Emergency</Badge>
                      </div>
                    )}

                    <CardHeader className="pb-3 pr-10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <CalendarIcon className="h-4 w-4 text-primary" />
                        </div>
                        {getStatusBadge(req.status)}
                      </div>
                      <CardTitle className="text-sm font-black uppercase tracking-tight">
                        {req.leave_type?.name}
                      </CardTitle>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        {format(parseISO(req.start_date), "MMM d")} – {format(parseISO(req.end_date), "MMM d, yyyy")}
                      </p>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between py-2 border-y border-border/10">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Duration</span>
                        <span className="text-sm font-bold">{days} {days === 1 ? "Day" : "Days"}</span>
                      </div>

                      <div className="space-y-0.5">
                        <span className="text-[10px] font-black uppercase text-muted-foreground">Reason</span>
                        <p className="text-xs text-foreground line-clamp-2 italic font-medium leading-relaxed">
                          "{req.reason}"
                        </p>
                      </div>



                      {/* Actions */}
                      {req.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-black uppercase text-[10px] h-9 mt-1"
                          onClick={() => handleCancel(req.id)}
                        >
                          Cancel Request
                        </Button>
                      )}


                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </PageWrapper>
  )
}
