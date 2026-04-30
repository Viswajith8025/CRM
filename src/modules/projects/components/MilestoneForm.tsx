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
import { useProjectsStore } from "../projectsStore"
import { toast } from "sonner"
import type { Milestone } from "../types"

const formSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional(),
  due_date: z.string().min(1, "Due date is required"),
})

interface MilestoneFormProps {
  projectId: string
  milestone?: Milestone
  onSuccess: () => void
}

export function MilestoneForm({ projectId, milestone, onSuccess }: MilestoneFormProps) {
  const { addMilestone, updateMilestone } = useProjectsStore()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: milestone?.title || "",
      description: milestone?.description || "",
      due_date: milestone?.due_date ? new Date(milestone.due_date).toISOString().split('T')[0] : "",
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      if (milestone) {
        await updateMilestone(milestone.id, values)
        toast.success("Milestone updated successfully")
      } else {
        await addMilestone({ ...values, project_id: projectId })
        toast.success("Milestone created successfully")
      }
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || "Failed to save milestone")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Phase 1: Design Approved" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Key deliverables for this checkpoint" {...field} />
              </FormControl>
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
        
        <Button type="submit" className="w-full mt-6 gap-2" disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLoading ? "Saving..." : milestone ? "Update Milestone" : "Create Milestone"}
        </Button>
      </form>
    </Form>
  )
}
