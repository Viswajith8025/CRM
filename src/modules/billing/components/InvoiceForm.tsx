import { useEffect, useState, useMemo } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, DollarSign, Calendar } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Switch } from "@/components/ui/switch"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useBillingStore } from "../billingStore"
import { useProjectsStore } from "@/modules/projects/projectsStore"
import { useCRMStore } from "@/modules/crm/crmStore"
import { useAuthStore } from "@/store/useAuthStore"
import { toast } from "sonner"
import type { Invoice } from "../types"
import { supabase } from "@/lib/supabase"

const formSchema = z.object({
  invoice_number: z.string().min(2, "Invoice number is required"),
  client_id: z.string().uuid("Please select a client"),
  project_id: z.string().uuid("Please select a project"),
  amount: z.coerce.number().positive("Amount must be positive"),
  tax_rate: z.coerce.number().min(0).max(100).optional(),
  is_recurring: z.boolean().default(false),
  frequency: z.enum(['monthly', 'quarterly', 'yearly']).nullable().optional(),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  due_date: z.string().min(1, "Due date is required"),
})

interface InvoiceFormProps {
  invoice?: Invoice
  defaultClientId?: string
  onSuccess: () => void
}

export function InvoiceForm({ invoice, defaultClientId, onSuccess }: InvoiceFormProps) {
  const { addInvoice, updateInvoice } = useBillingStore()
  const { projects, fetchProjects } = useProjectsStore()
  const { clients, fetchClients } = useCRMStore()
  const { profile: authProfile } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchProjects()
    fetchClients()
  }, [])

  const realClients = useMemo(() => {
    // Only show real clients, filtering out virtual lead records
    return clients.filter(c => !c.isVirtual)
  }, [clients])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoice_number: invoice?.invoice_number || `INV-${Math.floor(Math.random() * 10000)}`,
      client_id: invoice?.client_id || defaultClientId || "",
      project_id: invoice?.project_id || "",
      amount: invoice?.amount || 0,
      tax_rate: invoice?.tax_rate || 0,
      is_recurring: invoice?.is_recurring || false,
      frequency: invoice?.frequency || null,
      status: invoice?.status || "draft",
      due_date: invoice?.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const finalClientId = values.client_id
      const taxRate = values.tax_rate || 0
      const taxAmount = (values.amount * taxRate) / 100

      const submitData = {
        ...values,
        client_id: finalClientId,
        project_id: values.project_id === "none" ? null : values.project_id,
        tax_amount: taxAmount,
      }

      if (invoice) {
        await updateInvoice(invoice.id, submitData)
        toast.success("Invoice updated successfully")
      } else {
        await addInvoice(submitData)
        toast.success("Invoice created successfully")
      }
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || "Failed to save invoice")
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportUnbilledTime = async () => {
    const projectId = form.watch('project_id')
    if (!projectId || projectId === "none") {
      toast.error("Please select a project first to import time")
      return
    }

    try {
      setIsLoading(true)
      // Get all tasks for this project
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id')
        .eq('project_id', projectId)

      if (!tasks || tasks.length === 0) {
        toast.info("No tasks found for this project")
        return
      }

      const taskIds = tasks.map(t => t.id)

      // Get unbilled time logs for these tasks
      const { data: unbilledLogs, error } = await supabase
        .from('time_logs')
        .select('*')
        .in('task_id', taskIds)
        .eq('is_billable', true)
        .or('is_billed.eq.false,is_billed.is.null')

      if (error) throw error

      if (!unbilledLogs || unbilledLogs.length === 0) {
        toast.info("No unbilled time found for this project")
        return
      }

      // Calculate total amount based on $150/hr flat rate
      const totalMinutes = unbilledLogs.reduce((acc, curr) => acc + (curr.duration_minutes || 0), 0)
      const calculatedAmount = (totalMinutes / 60) * 150

      const currentAmount = Number(form.watch('amount')) || 0
      form.setValue('amount', currentAmount + calculatedAmount)
      
      toast.success(`Imported ${totalMinutes} minutes ($${calculatedAmount.toFixed(2)})`)
    } catch (err: any) {
      toast.error(err.message || "Failed to import time logs")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-[calc(100vh-140px)]">
        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-8 pb-8">
            {/* SECTION 1: BASIC INFO */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Basic Information</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="invoice_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Invoice Number</FormLabel>
                      <FormControl>
                        <Input {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
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
                  name="client_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Bill To</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select client..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectGroup>
                            <SelectLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Active Clients</SelectLabel>
                            {realClients.map(client => (
                              <SelectItem key={client.id} value={client.id}>
                                {client.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="project_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Project Link</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-muted/20">
                            <SelectValue placeholder="Select a project" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects
                            .filter(p => p.client_id === form.watch('client_id'))
                            .map(project => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* SECTION 2: FINANCIALS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
                    <DollarSign className="h-4 w-4" />
                  </div>
                  <h3 className="text-sm font-black uppercase tracking-widest">Financial Details</h3>
                </div>
                {form.watch('project_id') && (
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:bg-emerald-500/5"
                    onClick={handleImportUnbilledTime}
                    disabled={isLoading}
                  >
                    Import Unbilled Time
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Base Amount ($)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                          <Input type="number" step="0.01" {...field} className="pl-9 bg-muted/20 font-bold" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tax_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Tax Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tax Summary Display */}
              {(form.watch('tax_rate') || 0) > 0 && (
                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Including Tax</p>
                    <p className="text-xs text-emerald-500/70 font-medium">Applied {form.watch('tax_rate')}% VAT/Tax</p>
                  </div>
                  <div className="text-2xl font-black text-emerald-500">
                    ${(Number(form.watch('amount')) + (Number(form.watch('amount')) * Number(form.watch('tax_rate') || 0) / 100)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 3: BILLING SETTINGS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
                  <Calendar className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest">Settings & Deadlines</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground">Payment Due Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-muted/20" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4 pt-2">
                  <FormField
                    control={form.control}
                    name="is_recurring"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border border-border/50 p-3 bg-muted/10">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm font-bold">Recurring Billing</FormLabel>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-tight">Enable automated retainer billing</p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {form.watch('is_recurring') && (
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                            <FormControl>
                              <SelectTrigger className="bg-primary/5 border-primary/20">
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly Retainer</SelectItem>
                              <SelectItem value="quarterly">Quarterly Retainer</SelectItem>
                              <SelectItem value="yearly">Yearly Contract</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-4 pt-6 border-t mt-auto">
          <Button type="submit" className="flex-1 font-black uppercase tracking-[0.2em]" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {invoice ? "Update Invoice" : "Generate Invoice"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
