import { useState, useEffect } from "react"
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
import { useDepartmentStore } from "@/modules/dashboard/useDepartmentStore"
import type { HREmployee } from "../types"

const employeeSchema = z.object({
  department: z.string().optional().or(z.literal("")),
  designation: z.string().optional().or(z.literal("")),
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
  const { updateEmployee } = useHRStore()
  const { departments, fetchDepartments } = useDepartmentStore()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchDepartments()
  }, [])

  // Only show active departments in the dropdown
  const activeDepartments = departments.filter(d => d.status === 'active')

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
          {/* Department & Role are managed via Teams tab. We just display them here. */}
          <div className="space-y-1">
            <FormLabel>Department & Role</FormLabel>
            <div className="flex flex-col gap-1.5 pt-1">
              {employee?.department ? (
                <span className="text-sm font-bold text-sky-600">{employee.department}</span>
              ) : (
                <span className="text-sm text-muted-foreground italic">No department assigned</span>
              )}
              {employee?.designation && (
                <span className="text-xs font-bold text-muted-foreground">{employee.designation}</span>
              )}
              <span className="text-[10px] text-muted-foreground mt-1">
                Managed via Teams directory.
              </span>
            </div>
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
