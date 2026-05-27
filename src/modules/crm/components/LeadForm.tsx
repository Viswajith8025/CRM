import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2, User, Building, Target, Mail, Phone } from "lucide-react"
import { useState, useEffect } from "react"
import { useTeamStore } from "@/modules/admin/teamStore"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Contact as Lead } from "../types"
import { useCRMStore } from "../crmStore"
import { toast } from "sonner"

const formSchema = z.object({
  first_name: z.string().min(2, "First name is required"),
  last_name: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  company: z.string().optional(),
  phone: z.string().optional(),
  job_title: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'awaiting_payment', 'active_client', 'closed_lost']),
  source: z.string().optional(),
  requirement: z.string().optional(),
  brought_by_id: z.string().optional(),
  remarks: z.string().optional(),
})

interface LeadFormProps {
  lead?: Lead
  onSuccess: () => void
}

export function LeadForm({ lead, onSuccess }: LeadFormProps) {
  const { addLead, updateLead } = useCRMStore()
  const { members, fetchMembers } = useTeamStore()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchMembers()
  }, [])

  // Strict filter: sales role/dynamic_role AND department is BDE
  const strictBdeUsers = (members || []).filter(m => {
    const role = (m.role || '').toLowerCase()
    const dynRole = (m.dynamic_role_name || '').toLowerCase()
    const dept = (m.department || '').toLowerCase()
    const isSalesRole = role === 'sales' || dynRole === 'sales' || dynRole.includes('bde')
    const isBdeDept = dept === 'bde' || dept.includes('bde')
    return isSalesRole && isBdeDept
  })
  // Fallback: if no strict matches, show anyone with a sales/bde role
  const bdeUsers = strictBdeUsers.length > 0
    ? strictBdeUsers
    : (members || []).filter(m => {
        const role = (m.role || '').toLowerCase()
        const dynRole = (m.dynamic_role_name || '').toLowerCase()
        return role === 'sales' || dynRole === 'sales' || dynRole.includes('bde')
      })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: lead?.first_name || "",
      last_name: lead?.last_name || "",
      email: lead?.email || "",
      phone: lead?.phone || "",
      company: lead?.company || "",
      job_title: lead?.job_title || "",
      source: lead?.source || "website",
      status: lead?.status || "new",
      requirement: lead?.requirement || "",
      brought_by_id: lead?.brought_by_id || "",
      remarks: lead?.remarks || "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const payload = {
        ...values,
        brought_by_id: values.brought_by_id === 'none' ? undefined : (values.brought_by_id || undefined),
      }
      if (lead) {
        await updateLead(lead.id, payload)
        toast.success("Lead updated successfully")
      } else {
        await addLead(payload)
        toast.success("Lead created successfully")
      }
      onSuccess()
    } catch (error) {
      toast.error("An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-[calc(100vh-140px)]">
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-8 pb-8">
            {/* SECTION 1: CONTACT INFO */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Contact Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">First Name</FormLabel>
                      <FormControl>
                        <Input placeholder="John" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Last Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Doe" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Email Address</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input placeholder="john@example.com" {...field} className="pl-9 bg-muted/20" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION 2: COMPANY INFO */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
                  <Building className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Company Details</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Company Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Acme Inc" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="job_title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder="CEO" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Phone Number</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input placeholder="+1 (555) 000-0000" {...field} className="pl-9 bg-muted/20" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* SECTION 3: PIPELINE STRATEGY */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                  <Target className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Pipeline Strategy</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Lead Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="new">New Lead</SelectItem>
                          <SelectItem value="contacted">Contacted</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                          <SelectItem value="negotiation">Negotiation</SelectItem>
                          <SelectItem value="awaiting_payment">Awaiting Payment</SelectItem>
                          <SelectItem value="active_client">Active Client</SelectItem>
                          <SelectItem value="closed_lost">Closed Lost</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Acquisition Source</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="website">Website</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="linkedin">LinkedIn</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="requirement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Lead Requirement (Specified Service)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Needs a new ecommerce website" {...field} className="bg-muted/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="brought_by_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Brought By (BDE)</FormLabel>
                      <Select 
                        onValueChange={(val) => field.onChange(val === 'none' ? '' : val)} 
                        defaultValue={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select BDE User" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None / Unassigned</SelectItem>
                          {bdeUsers.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.first_name || user.full_name} {user.last_name || ''} ({user.role})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="remarks"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Internal Remarks</FormLabel>
                      <FormControl>
                        <Input placeholder="Additional notes about this lead..." {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-4 pt-6 border-t mt-auto">
          <Button type="submit" className="flex-1 font-black uppercase tracking-[0.2em]" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {lead ? "Update Lead" : "Create Lead"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
