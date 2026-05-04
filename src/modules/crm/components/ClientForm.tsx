import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { Client } from "../types"
import { useCRMStore } from "../store/crmStore"
import { toast } from "sonner"

const formSchema = z.object({
  name: z.string().min(2, "Client name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  service: z.string().min(2, "Service description is required"),
  contract_value: z.coerce.number().min(0, "Contract value must be positive"),
  address: z.string().optional(),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
})

interface ClientFormProps {
  client?: Client
  onSuccess: () => void
}

export function ClientForm({ client, onSuccess }: ClientFormProps) {
  const { addClient, updateClient } = useCRMStore()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: client?.name || "",
      email: client?.email || "",
      phone: client?.phone || "",
      service: client?.service || "",
      contract_value: client?.contract_value || 0,
      address: client?.address || "",
      website: client?.website || "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      if (client && !client.isVirtual) {
        await updateClient(client.id, values)
        toast.success("Client updated successfully")
      } else {
        // When converting a virtual client, ensure lead_id is passed if available
        const clientData = client?.isVirtual ? { ...values, lead_id: client.id } : values
        await addClient(clientData)
        toast.success(client?.isVirtual ? "Lead converted to client" : "Client added successfully")
      }
      onSuccess()
    } catch (error) {
      toast.error("Failed to save client")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client Name / Company</FormLabel>
              <FormControl>
                <Input placeholder="Acme Corporation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input placeholder="billing@acme.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl>
                  <Input placeholder="+1 (555) 000-0000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="service"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Provided</FormLabel>
                <FormControl>
                  <Input placeholder="Cloud Consulting" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contract_value"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contract Value ($)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
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
              <FormLabel>Business Address</FormLabel>
              <FormControl>
                <Input placeholder="123 Business Way, NY" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="w-full gap-2" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Saving..." : client ? "Update Client" : "Add Client"}
        </Button>
      </form>
    </Form>
  )
}
