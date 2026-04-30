import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
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
import { useBillingStore } from "../billingStore"
import { useProjectsStore } from "@/modules/projects/projectsStore"
import { toast } from "sonner"
import type { Invoice } from "../types"
import { supabase } from "@/lib/supabase"

const formSchema = z.object({
  invoice_number: z.string().min(2, "Invoice number is required"),
  client_id: z.string().uuid("Please select a client"),
  project_id: z.string().optional(),
  amount: z.coerce.number().positive("Amount must be positive"),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']),
  due_date: z.string().min(1, "Due date is required"),
})

interface InvoiceFormProps {
  invoice?: Invoice
  onSuccess: () => void
}

export function InvoiceForm({ invoice, onSuccess }: InvoiceFormProps) {
  const { addInvoice, updateInvoice } = useBillingStore()
  const { projects, fetchProjects } = useProjectsStore()
  const [clients, setClients] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    fetchProjects()
    // Fetch clients and qualified leads
    const fetchContacts = async () => {
      const [clientsRes, leadsRes] = await Promise.all([
        supabase.from('clients').select('id, name'),
        supabase.from('leads').select('id, first_name, last_name, company')
      ])

      const allContacts = [
        ...(clientsRes.data || []),
        ...(leadsRes.data || []).map(l => ({
          id: l.id,
          name: l.company || `${l.first_name} ${l.last_name || ''}`.trim()
        }))
      ]
      
      setClients(allContacts)
    }
    fetchContacts()
  }, [])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoice_number: invoice?.invoice_number || `INV-${Math.floor(Math.random() * 10000)}`,
      client_id: invoice?.client_id || "",
      project_id: invoice?.project_id || "none",
      amount: invoice?.amount || 0,
      status: invoice?.status || "draft",
      due_date: invoice?.due_date ? new Date(invoice.due_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      // Check if this is a lead that needs conversion
      const selectedContact = clients.find(c => c.id === values.client_id)
      const { data: existingClient } = await supabase.from('clients').select('id').eq('id', values.client_id).single()
      
      let finalClientId = values.client_id

      if (!existingClient && selectedContact) {
        // This is likely a lead ID. Try to fetch lead details to create a client
        const { data: leadData } = await supabase.from('leads').select('*').eq('id', values.client_id).single()
        
        if (leadData) {
          const { data: newClient, error: clientError } = await supabase.from('clients').insert({
            name: selectedContact.name,
            email: leadData.email,
            user_id: leadData.user_id
          }).select().single()
          
          if (clientError) throw clientError
          finalClientId = newClient.id
        }
      }

      const submitData = {
        ...values,
        client_id: finalClientId,
        project_id: values.project_id === "none" ? null : values.project_id,
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

  const selectedContact = clients.find(c => c.id === form.watch('client_id'))

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="invoice_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Number</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount ($)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="client_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedContact && (
                <div className="mt-2 p-2 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact Info</p>
                  <p className="text-sm font-bold">{selectedContact.name}</p>
                </div>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="project_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project (Optional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="none">No Project</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
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
          <FormField
            control={form.control}
            name="due_date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <Button type="submit" className="w-full mt-6 gap-2" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Saving..." : invoice ? "Update Invoice" : "Create Invoice"}
        </Button>
      </form>
    </Form>
  )
}
