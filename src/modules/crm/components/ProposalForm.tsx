import { useEffect, useState } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2, FileText, IndianRupee } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useCRMStore } from "../store/crmStore"
import { useAuthStore } from "@/store/useAuthStore"
import { toast } from "sonner"
import type { Client } from "../types"

const itemSchema = z.object({
  name: z.string().min(1, "Item name is required"),
  desc: z.string().min(1, "Description is required"),
  price: z.coerce.number().min(0, "Price must be positive"),
})

const formSchema = z.object({
  title: z.string().min(2, "Proposal title is required"),
  client_id: z.string().uuid("Please select a client"),
  service_name: z.string().min(2, "Service name is required"),
  description: z.string().min(10, "Project description is required"),
  items: z.array(itemSchema).min(1, "At least one item is required"),
  gst_percent: z.coerce.number().min(0).max(100).default(18),
  terms: z.array(z.string()).min(1, "At least one term is required"),
  valid_until: z.string().min(1, "Validity date is required"),
})

interface ProposalFormProps {
  client?: Client
  onSuccess: (proposalData: any) => void
}

export function ProposalForm({ client, onSuccess }: ProposalFormProps) {
  const { addProposal } = useCRMStore()
  const { profile } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: `Proposal for ${client?.name || 'Project'}`,
      client_id: client?.id || "",
      service_name: client?.service || "",
      description: "",
      items: [{ name: "", desc: "", price: 0 }],
      gst_percent: 18,
      terms: ["Payment should be made within 7 days of invoice generation.", "50% advance payment required to start the project."],
      valid_until: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  })

  const { fields: itemFields, append: appendItem, remove: removeItem } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const { fields: termFields, append: appendTerm, remove: removeTerm } = useFieldArray({
    control: form.control,
    name: "terms" as any,
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const subtotal = values.items.reduce((acc, item) => acc + item.price, 0)
      const gst_amount = (subtotal * values.gst_percent) / 100
      const total = subtotal + gst_amount

      const proposalData = {
        ...values,
        company_name: profile?.company_name || "ECRAFTZ ERP",
        company_email: profile?.email || "billing@ecraftz.com",
        company_phone: profile?.phone || "+91 98765 43210",
        company_gstin: "27AAAAA0000A1Z5", // Placeholder or from profile
        client_name: client?.name,
        client_company: client?.service || "Business Partner",
        client_email: client?.email,
        client_phone: client?.phone,
        date: new Date().toLocaleDateString(),
        proposal_id: `PROP-${Math.floor(Math.random() * 100000)}`,
        subtotal,
        gst_amount,
        total,
      }

      await addProposal({
        client_id: values.client_id,
        title: values.title,
        amount: total,
        status: 'draft',
        content: proposalData,
        valid_until: values.valid_until
      })

      toast.success("Proposal created successfully!")
      onSuccess(proposalData)
    } catch (error: any) {
      toast.error(error.message || "Failed to create proposal")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposal Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="service_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Service Type</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
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
                  <FormLabel>Project Description</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="Describe the scope of work..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pricing Items */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Pricing Items</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => appendItem({ name: "", desc: "", price: 0 })}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Item
                </Button>
              </div>
              
              {itemFields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-3 items-start bg-muted/20 p-3 rounded-lg border border-border/50">
                  <div className="col-span-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.name`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Item Name" className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-5">
                    <FormField
                      control={form.control}
                      name={`items.${index}.desc`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Input {...field} placeholder="Description" className="h-9" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-2">
                    <FormField
                      control={form.control}
                      name={`items.${index}.price`}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div className="relative">
                              <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                              <Input type="number" {...field} className="h-9 pl-6" />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="col-span-1">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => removeItem(index)}
                      className="h-9 w-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                      disabled={itemFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* GST & Validity */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gst_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST Percentage (%)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="valid_until"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Proposal Valid Until</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Terms */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Terms & Conditions</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => appendTerm("")}
                  className="h-8"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Term
                </Button>
              </div>
              
              {termFields.map((field, index) => (
                <div key={field.id} className="flex gap-2">
                  <FormField
                    control={form.control}
                    name={`terms.${index}` as any}
                    render={({ field }) => (
                      <FormItem className="flex-1">
                        <FormControl>
                          <Input {...field} placeholder={`Term ${index + 1}`} className="h-9" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeTerm(index)}
                    className="h-9 w-9 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </ScrollArea>

        <div className="flex gap-4 pt-4 border-t">
          <Button type="submit" className="flex-1 font-black uppercase tracking-widest" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Proposal PDF
          </Button>
        </div>
      </form>
    </Form>
  )
}
