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
import { Loader2, Trash2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuthStore } from "@/store/useAuthStore"
import { useProjectsStore } from "@/modules/projects"
import { toast } from "sonner"
import { format } from "date-fns"

const EXPENSE_CATEGORIES = [
  { value: "labour",       label: "Labour / Contractor" },
  { value: "software",     label: "Software / Subscriptions" },
  { value: "advertising",  label: "Advertising / Ad Spend" },
  { value: "travel",       label: "Travel & Logistics" },
  { value: "hardware",     label: "Hardware / Equipment" },
  { value: "outsourcing",  label: "Outsourcing / Freelancer" },
  { value: "hosting",      label: "Hosting / Infrastructure" },
  { value: "other",        label: "Other" },
]

const schema = z.object({
  project_id:   z.string().uuid("Select a project"),
  category:     z.string().min(1, "Select a category"),
  description:  z.string().min(2, "Description is required"),
  amount:       z.coerce.number().positive("Enter a valid amount"),
  expense_date: z.string().min(1, "Date is required"),
})

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectId?: string
  onSuccess?: () => void
}

interface Expense {
  id: string
  project_id: string
  category: string
  description: string
  amount: number
  expense_date: string
  project?: { name: string }
}

export function ProjectExpenseModal({ open, onOpenChange, defaultProjectId, onSuccess }: Props) {
  const { profile } = useAuthStore()
  const { projects, fetchProjects } = useProjectsStore()
  const [isLoading, setIsLoading] = useState(false)
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loadingExpenses, setLoadingExpenses] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      project_id:   defaultProjectId || "",
      category:     "labour",
      description:  "",
      amount:       0,
      expense_date: new Date().toISOString().split("T")[0],
    },
  })

  const watchedProject = form.watch("project_id")

  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    if (defaultProjectId) form.setValue("project_id", defaultProjectId)
  }, [defaultProjectId])

  const fetchExpenses = async () => {
    if (!profile?.organization_id) return
    setLoadingExpenses(true)
    const { data, error } = await supabase
      .from("project_expenses")
      .select("*, project:projects(name)")
      .eq("organization_id", profile.organization_id)
      .order("expense_date", { ascending: false })
      .limit(25)
    if (!error && data) setExpenses(data)
    setLoadingExpenses(false)
  }

  useEffect(() => {
    if (open) fetchExpenses()
  }, [open])

  const onSubmit = async (values: z.infer<typeof schema>) => {
    if (!profile?.organization_id || !profile?.id) return
    setIsLoading(true)
    try {
      const { error } = await supabase.from("project_expenses").insert({
        project_id:      values.project_id,
        organization_id: profile.organization_id,
        user_id:         profile.id,
        category:        values.category,
        description:     values.description,
        amount:          values.amount,
        expense_date:    values.expense_date,
      })
      if (error) throw error
      toast.success("Expense recorded successfully")
      form.reset({
        project_id:   values.project_id,
        category:     "labour",
        description:  "",
        amount:       0,
        expense_date: new Date().toISOString().split("T")[0],
      })
      fetchExpenses()
      onSuccess?.()
    } catch (err: any) {
      toast.error(err.message || "Failed to record expense")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const { error } = await supabase.from("project_expenses").delete().eq("id", id)
    if (!error) {
      setExpenses(prev => prev.filter(e => e.id !== id))
      toast.success("Expense deleted")
      onSuccess?.()
    } else {
      toast.error("Failed to delete expense")
    }
    setDeletingId(null)
  }

  const projectExpenses = watchedProject
    ? expenses.filter(e => e.project_id === watchedProject)
    : expenses

  const totalForProject = projectExpenses.reduce((acc, e) => acc + e.amount, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-black uppercase tracking-widest">
            Log Project Expense
          </DialogTitle>
          <DialogDescription>
            Record labour, ad spend, software, or any project cost to track real profitability.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/20">
                          <SelectValue placeholder="Select project..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.filter(p => !(p as any).is_archived && p.status !== 'completed' && p.status !== 'cancelled').map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-muted/20">
                          <SelectValue placeholder="Select category..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EXPENSE_CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Freelancer payment – UI design, Google Ads spend..." className="bg-muted/20" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount (₹)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-muted-foreground">₹</span>
                        <Input type="number" step="0.01" className="pl-7 bg-muted/20 font-bold" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="expense_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date</FormLabel>
                    <FormControl>
                      <Input type="date" className="bg-muted/20" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button type="submit" className="w-full font-black uppercase tracking-widest" disabled={isLoading}>
              {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Record Expense
            </Button>
          </form>
        </Form>

        {/* Expense log */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {watchedProject ? "Expenses for Selected Project" : "Recent Expenses"}
            </h4>
            {watchedProject && (
              <span className="text-xs font-black text-rose-500">
                Total: ₹{totalForProject.toLocaleString()}
              </span>
            )}
          </div>

          {loadingExpenses ? (
            <div className="h-12 rounded-lg bg-muted animate-pulse" />
          ) : projectExpenses.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center border border-dashed rounded-lg">
              No expenses logged yet. Add one above to start tracking profitability.
            </p>
          ) : (
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/30 border-b border-border/50">
                    <th className="p-3 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground">Date</th>
                    <th className="p-3 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground">Category</th>
                    <th className="p-3 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground">Description</th>
                    {!watchedProject && <th className="p-3 text-left font-black uppercase tracking-widest text-[9px] text-muted-foreground">Project</th>}
                    <th className="p-3 text-right font-black uppercase tracking-widest text-[9px] text-muted-foreground">Amount</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {projectExpenses.map(e => (
                    <tr key={e.id} className="hover:bg-muted/10 transition-colors">
                      <td className="p-3 text-muted-foreground">{format(new Date(e.expense_date), 'dd MMM yy')}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[9px] uppercase tracking-wide">
                          {EXPENSE_CATEGORIES.find(c => c.value === e.category)?.label || e.category}
                        </span>
                      </td>
                      <td className="p-3 font-medium max-w-[200px] truncate">{e.description}</td>
                      {!watchedProject && <td className="p-3 text-muted-foreground">{e.project?.name}</td>}
                      <td className="p-3 text-right font-black text-rose-500">₹{e.amount.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-rose-500"
                          onClick={() => handleDelete(e.id)}
                          disabled={deletingId === e.id}
                        >
                          {deletingId === e.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />
                          }
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
