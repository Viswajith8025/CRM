import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
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
import { toast } from "sonner"
import { useHRStore } from "../hrStore"
import type { HREmployee } from "../types"

const employeeSchema = z.object({
  department: z.string().min(2, "Department is required"),
  designation: z.string().min(2, "Designation is required"),
  base_salary: z.coerce.number().min(0),
  kpi_score: z.coerce.number().min(0).max(100),
  join_date: z.string(),
  user_id: z.string().uuid("Please select a user profile"),
})

interface EmployeeFormProps {
  employee?: HREmployee
  onSuccess?: () => void
}

export function EmployeeForm({ employee, onSuccess }: EmployeeFormProps) {
  const { updateEmployee, employees } = useHRStore()
  const [loading, setLoading] = useState(false)

  const form = useForm<z.infer<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      department: employee?.department || "",
      designation: employee?.designation || "",
      base_salary: employee?.base_salary || 0,
      kpi_score: employee?.kpi_score || 0,
      join_date: employee?.join_date || new Date().toISOString().split('T')[0],
      user_id: employee?.user_id || "",
    },
  })

  async function onSubmit(values: z.infer<typeof employeeSchema>) {
    setLoading(true)
    try {
      if (employee) {
        // Use user_id as the primary key for updates/upserts
        await updateEmployee(employee.user_id, values)
        toast.success("Employee updated successfully")
      }
      onSuccess?.()
    } catch (error) {
      console.error(error)
      toast.error("An error occurred while saving employee data")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="department"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Department</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Engineering" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="designation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Designation</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Senior Developer" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="base_salary"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Base Salary ($)</FormLabel>
                <FormControl>
                  <Input type="number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="kpi_score"
            render={({ field }) => (
              <FormItem>
                <FormLabel>KPI Score (%)</FormLabel>
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
          name="join_date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Join Date</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full font-bold" disabled={loading}>
          {loading ? "Saving..." : (employee ? "Update Employee" : "Add Employee")}
        </Button>
      </form>
    </Form>
  )
}
