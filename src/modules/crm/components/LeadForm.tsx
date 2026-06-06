import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Checkbox } from "@/components/ui/checkbox"
import { AVAILABLE_SERVICES } from "@/lib/serviceMappings"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, User, Building, Target, Mail, Phone, X } from "lucide-react"
import { useState, useEffect } from "react"
import PhoneInput, { isValidPhoneNumber } from "react-phone-number-input"
import "react-phone-number-input/style.css"
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
  phone: z.string().optional().refine((val) => {
    if (!val) return true
    return isValidPhoneNumber(val)
  }, "Must be a valid phone number (including country code)").or(z.literal("")),
  job_title: z.string().optional(),
  status: z.enum(['new', 'contacted', 'qualified', 'proposal_sent', 'negotiation', 'awaiting_payment', 'active_client', 'closed_lost']),
  source: z.string().optional(),
  requirement: z.string().optional(),
  brought_by_id: z.string().optional(),
  remarks: z.string().optional(),
  created_at: z.string().optional(),
  value: z.coerce.number().optional(),
  whatsapp: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  address: z.string().optional(),
  business_type: z.string().optional(),
  services_needed: z.string().optional(),
  target_locations: z.string().optional(),
  has_instagram: z.boolean().optional(),
  ig_username: z.string().optional(),
  ig_password: z.string().optional(),
  li_username: z.string().optional(),
  li_password: z.string().optional(),
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

  // Derive unique services from standard list + existing leads for dynamic dropdown
  const uniqueServices = Array.from(
    new Set([
      ...AVAILABLE_SERVICES,
      ...useCRMStore.getState().leads.map(l => l.requirement).filter(Boolean)
    ])
  ).sort()

  // Fully dynamic: use all fetched members
  const bdeUsers = members || []

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      first_name: lead?.first_name || "",
      last_name: lead?.last_name || "",
      email: lead?.email || "",
      phone: lead?.phone ? (lead.phone.startsWith('+') ? lead.phone : (lead.phone.replace(/\D/g, '').length === 10 ? `+91${lead.phone.replace(/\D/g, '')}` : `+${lead.phone.replace(/\D/g, '')}`)) : "",
      company: lead?.company || "",
      job_title: lead?.job_title || "",
      source: lead?.source || "website",
      status: lead?.status || "new",
      requirement: lead?.requirement || "",
      brought_by_id: lead?.brought_by_id || "",
      remarks: lead?.remarks || "",
      created_at: lead?.created_at ? new Date(lead.created_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      value: lead?.value || undefined,
      whatsapp: lead?.whatsapp || "",
      website: lead?.website || "",
      address: lead?.address || "",
      business_type: lead?.business_type || "",
      services_needed: lead?.services_needed || "",
      target_locations: lead?.target_locations || "",
      has_instagram: lead?.has_instagram || false,
      ig_username: lead?.ig_username || "",
      ig_password: lead?.ig_password || "",
      li_username: lead?.li_username || "",
      li_password: lead?.li_password || "",
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
    } catch (error: any) {
      console.error("LEAD FORM ERROR:", error);
      
      // EXPLICIT CHECK FOR THE DATABASE TRIGGER BUG
      const errMsg = error?.details || error?.message || "";
      if (errMsg.includes('converted') || error?.code === '22P02') {
        const sqlFix = `
-- COPY THIS EXACT TEXT AND PASTE IT INTO SUPABASE SQL EDITOR AND CLICK RUN
BEGIN;
CREATE OR REPLACE FUNCTION public.sync_lead_to_client()
RETURNS TRIGGER SECURITY DEFINER AS $$
DECLARE
  v_client_id UUID;
  v_client_name TEXT;
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.status::text IN ('active_client', 'converted') THEN
    IF NEW.first_name IS NOT NULL THEN v_client_name := TRIM(CONCAT(NEW.first_name, ' ', COALESCE(NEW.last_name, '')));
    ELSE v_client_name := COALESCE(NEW.company, 'Unknown Client'); END IF;
    SELECT id INTO v_client_id FROM public.clients WHERE lead_id = NEW.id LIMIT 1;
    IF v_client_id IS NULL AND NEW.email IS NOT NULL THEN
      SELECT id INTO v_client_id FROM public.clients WHERE email = NEW.email AND organization_id = NEW.organization_id LIMIT 1;
    END IF;
    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (organization_id, lead_id, name, email, phone, contract_value, user_id)
      VALUES (NEW.organization_id, NEW.id, v_client_name, NEW.email, NEW.phone, NEW.value, NEW.user_id);
    ELSE
      UPDATE public.clients SET name = v_client_name, email = COALESCE(NEW.email, public.clients.email), phone = COALESCE(NEW.phone, public.clients.phone), contract_value = COALESCE(NEW.value, public.clients.contract_value) WHERE id = v_client_id AND lead_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.audit_lead_status_changes()
RETURNS TRIGGER SECURITY DEFINER AS $$
BEGIN
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;
  IF NEW.status::text IN ('active_client', 'converted') AND OLD.status::text NOT IN ('active_client', 'converted') THEN
    INSERT INTO public.activities (organization_id, user_id, action, target_type, target_name, target_id, metadata) 
    VALUES (NEW.organization_id, NEW.user_id, 'converted', 'Lead', TRIM(CONCAT(NEW.first_name, ' ', COALESCE(NEW.last_name, ''))), NEW.id::text, jsonb_build_object('message', 'Lead converted to Client', 'lead_title', TRIM(CONCAT(NEW.first_name, ' ', COALESCE(NEW.last_name, '')))));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMIT;
`;
        navigator.clipboard.writeText(sqlFix).then(() => {
          toast.success("SQL Fix copied to your clipboard! Paste it in Supabase.", { duration: 10000 });
          alert("I HAVE COPIED THE FIX TO YOUR CLIPBOARD!\n\n1. Go to vbosonyrosxfttyoengz.supabase.co\n2. Click 'SQL Editor' on the left menu.\n3. Click 'New query'.\n4. Paste (Ctrl+V) the code I just copied to your clipboard.\n5. Click 'RUN'.\n\nI CANNOT DO THIS FOR YOU. YOU MUST DO IT.");
        });
      } else {
        toast.error(errMsg || "An error occurred while saving the lead.");
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col max-h-[80vh] h-full sm:h-[calc(100vh-140px)]">
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
                        <PhoneInput 
                          placeholder="Enter phone number" 
                          defaultCountry="IN"
                          international
                          withCountryCallingCode
                          limitMaxLength={true}
                          value={field.value}
                          onChange={field.onChange}
                          className="flex h-10 w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        />
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="requirement"
                  render={({ field }) => {
                    const selectedServices = field.value ? field.value.split(',').map(s => s.trim()).filter(Boolean) : []
                    return (
                      <FormItem className="col-span-1 md:col-span-2">
                        <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Lead Requirement (Services Needed)</FormLabel>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {selectedServices.map(service => (
                            <Badge key={service} variant="secondary" className="flex items-center gap-1 pr-1 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors">
                              {service}
                              <div
                                role="button"
                                tabIndex={0}
                                className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-primary/20 cursor-pointer"
                                onClick={(e) => {
                                  e.preventDefault();
                                  field.onChange(selectedServices.filter(s => s !== service).join(', '));
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') field.onChange(selectedServices.filter(s => s !== service).join(', '));
                                }}
                              >
                                <X className="h-3 w-3" />
                              </div>
                            </Badge>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <Select
                            onValueChange={(val) => {
                              if (val && !selectedServices.includes(val)) {
                                field.onChange([...selectedServices, val].join(', '))
                              }
                            }}
                          >
                            <FormControl>
                              <SelectTrigger className="bg-muted/20 flex-1">
                                <SelectValue placeholder="Add a standard service..." />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {uniqueServices.filter(s => !selectedServices.includes(s)).map((service) => (
                                <SelectItem key={service} value={service}>{service}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          
                          <Input 
                            placeholder="Or type custom service..." 
                            className="bg-muted/20 flex-1"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = e.currentTarget.value.trim();
                                if (val && !selectedServices.includes(val)) {
                                  field.onChange([...selectedServices, val].join(', '));
                                  e.currentTarget.value = '';
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const val = e.target.value.trim();
                              if (val && !selectedServices.includes(val)) {
                                field.onChange([...selectedServices, val].join(', '));
                                e.target.value = '';
                              }
                            }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Select from dropdown or type custom service and press Enter.</p>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
                
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Estimated Value ($)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} value={field.value || ''} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="created_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Date Added</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="brought_by_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
                        Brought By (BDE)
                      </FormLabel>
                      <FormControl>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-muted/20 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          value={field.value || ''}
                          onChange={e => field.onChange(e.target.value || undefined)}
                        >
                          <option value="">None / Unassigned</option>
                          {bdeUsers.map(user => (
                            <option key={user.id} value={user.id}>
                              {user.full_name || user.email || user.id} ({user.dynamic_role_name || 'Sales'})
                            </option>
                          ))}
                        </select>
                      </FormControl>
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

            {/* SECTION 4: EXTENDED ONBOARDING DETAILS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-500">
                  <User className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Extended Onboarding Details</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="business_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Business Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="e.g. B2B, B2C, SaaS" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="B2B">B2B</SelectItem>
                          <SelectItem value="B2C">B2C</SelectItem>
                          <SelectItem value="Ecommerce">Ecommerce</SelectItem>
                          <SelectItem value="SaaS">SaaS</SelectItem>
                          <SelectItem value="Hybrid">Hybrid</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="services_needed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Services Needed (Comma Separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="Web, SEO, Marketing" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/50 pt-4">
                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">WhatsApp Number</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 555-0199" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="website"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Website URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://..." {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="target_locations"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Target Locations</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. US, UK, India" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Full Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St, City, Country" {...field} className="bg-muted/20" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-border/50 pt-4">
                <FormField
                  control={form.control}
                  name="ig_username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Instagram Username</FormLabel>
                      <FormControl>
                        <Input placeholder="@username" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ig_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Instagram Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="li_username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">LinkedIn Username</FormLabel>
                      <FormControl>
                        <Input placeholder="username" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="li_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">LinkedIn Password</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} className="bg-muted/20" />
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
