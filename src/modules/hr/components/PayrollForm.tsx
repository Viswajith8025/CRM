import { useState, useEffect } from "react"
import { DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useHRStore } from "../hrStore"
import { toast } from "sonner"
import { Calculator } from "lucide-react"

interface PayrollFormProps {
  payrollRecord: any
  onSuccess: () => void
}

export function PayrollForm({ payrollRecord, onSuccess }: PayrollFormProps) {
  const { updatePayroll } = useHRStore()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [formData, setFormData] = useState({
    basic_pay: 0,
    allowances: 0,
    deductions: 0,
    status: 'draft'
  })

  // Automatically calculate net pay
  const netPay = (Number(formData.basic_pay) || 0) + (Number(formData.allowances) || 0) - (Number(formData.deductions) || 0)

  useEffect(() => {
    if (payrollRecord) {
      setFormData({
        basic_pay: payrollRecord.basic_pay || 0,
        allowances: payrollRecord.allowances || 0,
        deductions: payrollRecord.deductions || 0,
        status: payrollRecord.status || 'draft'
      })
    }
  }, [payrollRecord])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!payrollRecord) return

    setIsSubmitting(true)
    try {
      await updatePayroll(payrollRecord.id, {
        basic_pay: Number(formData.basic_pay),
        allowances: Number(formData.allowances),
        deductions: Number(formData.deductions),
        net_pay: netPay,
        status: formData.status
      })
      toast.success("Payroll record updated successfully")
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || "Failed to update payroll")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-4">
      <DialogHeader>
        <DialogTitle className="text-xl">
          Process Payroll for {payrollRecord?.profile?.full_name || 'Employee'}
        </DialogTitle>
        <DialogDescription>
          Adjust the basic pay, allowances, and deductions for {payrollRecord?.month} {payrollRecord?.year}. The net pay will be calculated automatically.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Basic Pay ($)</Label>
            <Input 
              type="number"
              min="0"
              step="0.01"
              value={formData.basic_pay}
              onChange={(e) => setFormData(prev => ({ ...prev, basic_pay: parseFloat(e.target.value) || 0 }))}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Allowances / Bonus ($)</Label>
            <Input 
              type="number"
              min="0"
              step="0.01"
              value={formData.allowances}
              onChange={(e) => setFormData(prev => ({ ...prev, allowances: parseFloat(e.target.value) || 0 }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Deductions / Taxes ($)</Label>
            <Input 
              type="number"
              min="0"
              step="0.01"
              value={formData.deductions}
              onChange={(e) => setFormData(prev => ({ ...prev, deductions: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Payroll Status</Label>
            <Select 
              value={formData.status} 
              onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-4 bg-muted/50 rounded-xl border border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Calculator className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Calculated Net Pay</span>
              <span className="text-xl font-black">${netPay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-border">
        <Button variant="outline" type="button" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : "Save Payroll Record"}
        </Button>
      </div>
    </form>
  )
}
