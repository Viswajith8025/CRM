import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog"
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage
} from "@/components/ui/form"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, ShieldCheck, Building2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { toast } from "sonner"

export const INDIA_STATES = [
  { code: "01", name: "Jammu & Kashmir" }, { code: "02", name: "Himachal Pradesh" },
  { code: "03", name: "Punjab" }, { code: "04", name: "Chandigarh" },
  { code: "05", name: "Uttarakhand" }, { code: "06", name: "Haryana" },
  { code: "07", name: "Delhi" }, { code: "08", name: "Rajasthan" },
  { code: "09", name: "Uttar Pradesh" }, { code: "10", name: "Bihar" },
  { code: "11", name: "Sikkim" }, { code: "12", name: "Arunachal Pradesh" },
  { code: "13", name: "Nagaland" }, { code: "14", name: "Manipur" },
  { code: "15", name: "Mizoram" }, { code: "16", name: "Tripura" },
  { code: "17", name: "Meghalaya" }, { code: "18", name: "Assam" },
  { code: "19", name: "West Bengal" }, { code: "20", name: "Jharkhand" },
  { code: "21", name: "Odisha" }, { code: "22", name: "Chhattisgarh" },
  { code: "23", name: "Madhya Pradesh" }, { code: "24", name: "Gujarat" },
  { code: "26", name: "Dadra & Nagar Haveli and Daman & Diu" },
  { code: "27", name: "Maharashtra" }, { code: "28", name: "Andhra Pradesh" },
  { code: "29", name: "Karnataka" }, { code: "30", name: "Goa" },
  { code: "31", name: "Lakshadweep" }, { code: "32", name: "Kerala" },
  { code: "33", name: "Tamil Nadu" }, { code: "34", name: "Puducherry" },
  { code: "35", name: "Andaman & Nicobar Islands" }, { code: "36", name: "Telangana" },
  { code: "37", name: "Andhra Pradesh (New)" }, { code: "38", name: "Ladakh" },
]

const schema = z.object({
  gstin:       z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, "Enter a valid 15-digit GSTIN").or(z.literal("")),
  legal_name:  z.string().min(2, "Legal name is required"),
  trade_name:  z.string().optional(),
  pan_number:  z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Enter a valid 10-character PAN").or(z.literal("")),
  state_code:  z.string().min(1, "State is required"),
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GSTSettingsModal({ open, onOpenChange }: Props) {
  const { profile } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(null)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      gstin: "", legal_name: "", trade_name: "", pan_number: "", state_code: "",
    },
  })

  useEffect(() => {
    if (!open || !profile?.organization_id) return
    setIsFetching(true)
    supabase
      .from("gst_profiles")
      .select("*")
      .eq("organization_id", profile.organization_id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingId(data.id)
          form.reset({
            gstin: data.gstin || "",
            legal_name: data.legal_name || "",
            trade_name: data.trade_name || "",
            pan_number: data.pan_number || "",
            state_code: data.state_code || "",
          })
        }
        setIsFetching(false)
      })
  }, [open])

  // Auto-extract state code from GSTIN
  const handleGSTINChange = (val: string) => {
    form.setValue("gstin", val.toUpperCase())
    if (val.length >= 2) {
      const stateCode = val.substring(0, 2).padStart(2, "0")
      const matchedState = INDIA_STATES.find(s => s.code === stateCode)
      if (matchedState) form.setValue("state_code", stateCode)
    }
  }

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!profile?.organization_id) return
    setIsLoading(true)
    try {
      const payload = { ...values, organization_id: profile.organization_id, is_registered: !!values.gstin }
      if (existingId) {
        const { error } = await supabase.from("gst_profiles").update(payload).eq("id", existingId)
        if (error) throw error
      } else {
        const { error } = await supabase.from("gst_profiles").insert(payload)
        if (error) throw error
      }
      toast.success("GST profile saved! Your invoices will now auto-apply the correct CGST/SGST or IGST.")
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to save GST profile")
    } finally {
      setIsLoading(false)
    }
  }

  const selectedState = INDIA_STATES.find(s => s.code === form.watch("state_code"))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-black uppercase tracking-widest">GST Profile Setup</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Your organization's tax identity. Used to auto-calculate CGST/SGST vs IGST on invoices.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isFetching ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">

              <FormField
                control={form.control}
                name="gstin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      GSTIN <span className="text-muted-foreground/50 normal-case">(15-digit GST Identification Number)</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. 32AAAAA0000A1Z5"
                        className="bg-muted/20 font-mono uppercase"
                        {...field}
                        onChange={e => handleGSTINChange(e.target.value)}
                        maxLength={15}
                      />
                    </FormControl>
                    {field.value.length === 15 && (
                      <p className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 mt-1">
                        <ShieldCheck className="h-3 w-3" /> Valid format
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="legal_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Legal Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="As per GST registration" className="bg-muted/20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trade_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Trade / Brand Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Optional" className="bg-muted/20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="pan_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">PAN Number</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. AAAAA0000A"
                          className="bg-muted/20 font-mono uppercase"
                          {...field}
                          onChange={e => field.onChange(e.target.value.toUpperCase())}
                          maxLength={10}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">State of Registration</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select state..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="max-h-64">
                          {INDIA_STATES.map(s => (
                            <SelectItem key={s.code} value={s.code}>
                              <span className="font-mono text-xs text-muted-foreground mr-2">{s.code}</span>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {selectedState && (
                <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-blue-400 shrink-0" />
                  <div className="text-xs">
                    <p className="font-black text-foreground">{selectedState.name}</p>
                    <p className="text-muted-foreground mt-0.5">
                      Invoices to clients in <strong>{selectedState.name}</strong> → <Badge variant="outline" className="text-[9px] text-emerald-500 border-emerald-500/30 mx-0.5">CGST + SGST</Badge>
                      | Other states → <Badge variant="outline" className="text-[9px] text-amber-500 border-amber-500/30 mx-0.5">IGST</Badge>
                    </p>
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full font-black uppercase tracking-widest" disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                Save GST Profile
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
