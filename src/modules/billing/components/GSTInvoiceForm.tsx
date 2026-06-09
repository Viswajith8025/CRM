import { useState, useEffect, useMemo, useCallback } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Trash2, ShieldCheck, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { useCRMStore } from "@/modules/crm"
import { useProjectsStore } from "@/modules/projects"
import { toast } from "sonner"
import { INDIA_STATES } from "./GSTSettingsModal"

// GST Slabs
const GST_RATES = [
  { label: "Exempt (0%)", rate: 0, type: "exempt" },
  { label: "GST 5%",      rate: 5,  type: "intra_state" },
  { label: "GST 12%",     rate: 12, type: "intra_state" },
  { label: "GST 18%",     rate: 18, type: "intra_state" },
  { label: "GST 28%",     rate: 28, type: "intra_state" },
]

const lineItemSchema = z.object({
  item_name:    z.string().min(1, "Required"),
  description:  z.string().optional(),
  hsn_sac:      z.string().optional(),
  quantity:     z.coerce.number().positive().default(1),
  unit_price:   z.coerce.number().min(0).default(0),
  gst_rate:     z.coerce.number().min(0).default(18),
})

const schema = z.object({
  invoice_number: z.string().min(1),
  document_type:  z.enum(["Estimate", "Proforma Invoice", "Tax Invoice", "GST Invoice", "Credit Note"]).default("Tax Invoice"),
  client_id:      z.string().uuid("Select a client"),
  project_id:     z.string().optional(),
  date:           z.string().min(1),
  due_date:       z.string().min(1),
  status:         z.enum(["draft", "sent", "paid", "overdue", "cancelled"]),
  place_of_supply: z.string().min(1, "Required for GST"),
  notes:          z.string().optional(),
  terms:          z.string().optional(),
  items:          z.array(lineItemSchema).min(1, "Add at least one item"),
})

type FormValues = z.infer<typeof schema>

interface GSTProfile { state_code: string; gstin?: string; legal_name?: string }
interface TaxBreakdown {
  taxable: number
  cgst: number
  sgst: number
  igst: number
  totalTax: number
  grandTotal: number
  isInterState: boolean
}

interface Props {
  onSuccess: () => void
  defaultClientId?: string
}

function calcGST(items: FormValues["items"], sellerState: string, buyerState: string): TaxBreakdown {
  const isInterState = sellerState !== buyerState || !sellerState || !buyerState
  let taxable = 0, cgst = 0, sgst = 0, igst = 0

  for (const item of items) {
    const lineTotal = (item.quantity || 0) * (item.unit_price || 0)
    const rate = item.gst_rate || 0
    taxable += lineTotal
    if (isInterState) {
      igst += (lineTotal * rate) / 100
    } else {
      cgst += (lineTotal * rate / 2) / 100
      sgst += (lineTotal * rate / 2) / 100
    }
  }

  const totalTax = cgst + sgst + igst
  return { taxable, cgst, sgst, igst, totalTax, grandTotal: taxable + totalTax, isInterState }
}

export function GSTInvoiceForm({ onSuccess, defaultClientId }: Props) {
  const { profile } = useAuthStore()
  const { clients, fetchClients } = useCRMStore()
  const { projects, fetchProjects } = useProjectsStore()
  const [isLoading, setIsLoading] = useState(false)
  const [gstProfile, setGstProfile] = useState<GSTProfile | null>(null)
  const [clientStateCode, setClientStateCode] = useState("")

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      document_type: "Tax Invoice",
      invoice_number: `INV-${Math.floor(Math.random() * 90000) + 10000}`,
      client_id: defaultClientId || "",
      project_id: "",
      date: new Date().toISOString().split("T")[0],
      due_date: new Date(Date.now() + 15 * 86400000).toISOString().split("T")[0],
      status: "draft",
      place_of_supply: "",
      notes: "",
      terms: "Payment due within 15 days of invoice date.",
      items: [{ item_name: "", description: "", hsn_sac: "", quantity: 1, unit_price: 0, gst_rate: 18 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" })

  useEffect(() => {
    fetchClients()
    fetchProjects()
    if (profile?.organization_id) {
      supabase.from("gst_profiles").select("*")
        .eq("organization_id", profile.organization_id)
        .maybeSingle()
        .then(({ data }) => { if (data) setGstProfile(data) })
    }
  }, [])

  const watchedItems = form.watch("items")
  const watchedClientId = form.watch("client_id")
  const watchedSupply = form.watch("place_of_supply")

  // When client changes, auto-set place_of_supply from client's state_code
  useEffect(() => {
    if (!watchedClientId) return
    const client = clients.find(c => c.id === watchedClientId)
    const code = (client as any)?.state_code || ""
    setClientStateCode(code)
    if (code && !form.getValues("place_of_supply")) {
      form.setValue("place_of_supply", code)
    }
  }, [watchedClientId, clients])

  const breakdown = useMemo(
    () => calcGST(watchedItems || [], gstProfile?.state_code || "", watchedSupply),
    [watchedItems, gstProfile, watchedSupply]
  )

  const realClients = useMemo(() => clients.filter(c => {
    if ((c as any).isVirtual) return false;
    const leadStatus = (c as any).leads?.status;
    return !leadStatus || leadStatus === 'active_client';
  }), [clients])

  const onSubmit = async (values: FormValues) => {
    if (!profile?.organization_id || !profile?.id) return
    setIsLoading(true)
    try {
      const { isInterState, taxable, cgst, sgst, igst, totalTax, grandTotal } = breakdown

      // 1. Create invoice
      const { data: inv, error: invErr } = await supabase
        .from("invoices")
        .insert({
          organization_id: profile.organization_id,
          document_type:   values.document_type,
          client_id:       values.client_id,
          project_id:      values.project_id || null,
          invoice_number:  values.invoice_number,
          date:            values.date,
          due_date:        values.due_date,
          status:          values.status,
          place_of_supply: values.place_of_supply,
          tax_type:        isInterState ? "inter_state" : "intra_state",
          subtotal:        taxable,
          total_tax:       totalTax,
          grand_total:     grandTotal,
          amount_due:      grandTotal,
          notes:           values.notes,
          terms:           values.terms,
          created_by:      profile.id,
          deleted_at:      null,
        })
        .select("id")
        .single()

      if (invErr) throw invErr

      // 2. Create line items
      const itemRows = values.items.map(item => {
        const lineTotal = item.quantity * item.unit_price
        const rate = item.gst_rate
        return {
          invoice_id:    inv.id,
          item_name:     item.item_name,
          description:   item.description || null,
          hsn_sac:       item.hsn_sac || null,
          quantity:      item.quantity,
          unit_price:    item.unit_price,
          taxable_value: lineTotal,
          cgst_amount:   isInterState ? 0 : (lineTotal * rate / 2) / 100,
          sgst_amount:   isInterState ? 0 : (lineTotal * rate / 2) / 100,
          igst_amount:   isInterState ? (lineTotal * rate) / 100 : 0,
          total_amount:  lineTotal + (isInterState ? (lineTotal * rate) / 100 : (lineTotal * rate) / 100),
        }
      })
      await supabase.from("invoice_items").insert(itemRows)

      // 3. Create tax summary rows
      const taxRows: any[] = []
      if (!isInterState && cgst > 0) {
        taxRows.push({ invoice_id: inv.id, tax_name: "CGST", taxable_amount: taxable, tax_amount: cgst })
        taxRows.push({ invoice_id: inv.id, tax_name: "SGST", taxable_amount: taxable, tax_amount: sgst })
      } else if (igst > 0) {
        taxRows.push({ invoice_id: inv.id, tax_name: "IGST", taxable_amount: taxable, tax_amount: igst })
      }
      if (taxRows.length) await supabase.from("invoice_taxes").insert(taxRows)

      toast.success("GST Invoice created successfully!")
      onSuccess()
    } catch (err: any) {
      toast.error(err.message || "Failed to create invoice")
    } finally {
      setIsLoading(false)
    }
  }

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
        <ScrollArea className="flex-1 max-h-[70vh] pr-3">
          <div className="space-y-6">

            {/* GST Profile Banner */}
            {gstProfile ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="text-xs">
                  <span className="font-black text-emerald-600 dark:text-emerald-400">{gstProfile.legal_name}</span>
                  <span className="text-muted-foreground ml-2 font-mono">{gstProfile.gstin}</span>
                  <span className="ml-2 text-muted-foreground">· {INDIA_STATES.find(s => s.code === gstProfile.state_code)?.name}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold">
                  GST profile not configured. Go to Billing → Settings to set up your GSTIN.
                </p>
              </div>
            )}

            {/* Header Fields */}
            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="document_type" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Doc Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="bg-muted/20"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["Estimate", "Proforma Invoice", "Tax Invoice", "GST Invoice", "Credit Note"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="invoice_number" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Document No.</FormLabel>
                  <FormControl><Input className="bg-muted/20 font-mono" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger className="bg-muted/20"><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["draft","sent","paid","overdue","cancelled"].map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="client_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bill To (Client)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="bg-muted/20"><SelectValue placeholder="Select client..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {realClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="place_of_supply" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    Place of Supply
                    {breakdown.isInterState
                      ? <Badge variant="outline" className="ml-2 text-[9px] text-amber-500 border-amber-500/30">IGST</Badge>
                      : <Badge variant="outline" className="ml-2 text-[9px] text-emerald-500 border-emerald-500/30">CGST + SGST</Badge>
                    }
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger className="bg-muted/20"><SelectValue placeholder="Select state..." /></SelectTrigger></FormControl>
                    <SelectContent className="max-h-60">
                      {INDIA_STATES.map(s => (
                        <SelectItem key={s.code} value={s.code}>
                          <span className="font-mono text-xs text-muted-foreground mr-2">{s.code}</span>{s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="project_id" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project (Optional)</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                    <FormControl><SelectTrigger className="bg-muted/20"><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {projects.filter(p => !(p as any).is_archived && p.status !== 'completed' && p.status !== 'cancelled').map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Invoice Date</FormLabel>
                  <FormControl><Input type="date" className="bg-muted/20" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="due_date" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Due Date</FormLabel>
                  <FormControl><Input type="date" className="bg-muted/20" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Line Items</h3>
                <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-[10px] font-black"
                  onClick={() => append({ item_name: "", description: "", hsn_sac: "", quantity: 1, unit_price: 0, gst_rate: 18 })}>
                  <Plus className="h-3 w-3" /> Add Item
                </Button>
              </div>

              <div className="rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/50">
                      <th className="p-2 text-left font-black uppercase tracking-wider text-[9px] text-muted-foreground w-[28%]">Item / Service</th>
                      <th className="p-2 text-left font-black uppercase tracking-wider text-[9px] text-muted-foreground w-[12%]">HSN/SAC</th>
                      <th className="p-2 text-left font-black uppercase tracking-wider text-[9px] text-muted-foreground w-[8%]">Qty</th>
                      <th className="p-2 text-left font-black uppercase tracking-wider text-[9px] text-muted-foreground w-[14%]">Rate (₹)</th>
                      <th className="p-2 text-left font-black uppercase tracking-wider text-[9px] text-muted-foreground w-[14%]">GST %</th>
                      <th className="p-2 text-right font-black uppercase tracking-wider text-[9px] text-muted-foreground w-[14%]">Total (₹)</th>
                      <th className="w-[6%]"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {fields.map((field, index) => {
                      const qty = form.watch(`items.${index}.quantity`) || 0
                      const rate = form.watch(`items.${index}.unit_price`) || 0
                      const gst = form.watch(`items.${index}.gst_rate`) || 0
                      const lineNet = qty * rate
                      const tax = (lineNet * gst) / 100
                      const lineTotal = lineNet + tax
                      return (
                        <tr key={field.id} className="hover:bg-muted/5">
                          <td className="p-1.5">
                            <Input {...form.register(`items.${index}.item_name`)} placeholder="e.g. Web Design" className="bg-transparent border-0 shadow-none h-8 text-xs focus-visible:ring-1 focus-visible:ring-primary/40" />
                          </td>
                          <td className="p-1.5">
                            <Input {...form.register(`items.${index}.hsn_sac`)} placeholder="998314" className="bg-transparent border-0 shadow-none h-8 text-xs font-mono focus-visible:ring-1 focus-visible:ring-primary/40" />
                          </td>
                          <td className="p-1.5">
                            <Input type="number" {...form.register(`items.${index}.quantity`)} className="bg-transparent border-0 shadow-none h-8 text-xs focus-visible:ring-1 focus-visible:ring-primary/40" />
                          </td>
                          <td className="p-1.5">
                            <Input type="number" step="0.01" {...form.register(`items.${index}.unit_price`)} className="bg-transparent border-0 shadow-none h-8 text-xs focus-visible:ring-1 focus-visible:ring-primary/40" />
                          </td>
                          <td className="p-1.5">
                            <select
                              {...form.register(`items.${index}.gst_rate`, { valueAsNumber: true })}
                              className="w-full h-8 bg-transparent text-xs rounded-md border border-border/40 px-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
                            >
                              {GST_RATES.map(r => (
                                <option key={r.rate} value={r.rate}>{r.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="p-1.5 text-right font-black text-xs">{fmt(lineTotal)}</td>
                          <td className="p-1.5 text-center">
                            {fields.length > 1 && (
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-rose-500"
                                onClick={() => remove(index)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* GST Breakdown */}
            <div className="rounded-xl bg-muted/20 border border-border/40 p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground font-bold">Subtotal (Taxable)</span>
                <span className="font-mono font-bold">{fmt(breakdown.taxable)}</span>
              </div>
              {!breakdown.isInterState ? (
                <>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>CGST</span>
                    <span className="font-mono">{fmt(breakdown.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>SGST</span>
                    <span className="font-mono">{fmt(breakdown.sgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>IGST</span>
                  <span className="font-mono">{fmt(breakdown.igst)}</span>
                </div>
              )}
              <Separator className="opacity-30" />
              <div className="flex justify-between text-sm font-black">
                <span>Grand Total</span>
                <span className="text-primary text-base">{fmt(breakdown.grandTotal)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Notes</FormLabel>
                  <FormControl><textarea rows={2} className="w-full rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" placeholder="Thank you for your business!" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="terms" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Terms & Conditions</FormLabel>
                  <FormControl><textarea rows={2} className="w-full rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>
          </div>
        </ScrollArea>

        <Button type="submit" size="lg" className="w-full font-black uppercase tracking-widest" disabled={isLoading}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
          Generate Document · {fmt(breakdown.grandTotal)}
        </Button>
      </form>
    </Form>
  )
}
