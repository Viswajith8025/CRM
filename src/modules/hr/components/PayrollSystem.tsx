import { useState, useEffect } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, DollarSign, Download, Filter, Edit2 } from "lucide-react"
import { useHRStore } from "../hrStore"
import { format } from "date-fns"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { PayrollForm } from "./PayrollForm"

export function PayrollSystem() {
  const { payroll, fetchPayroll, generatePayroll, isLoading, employees, fetchEmployees } = useHRStore()
  const [search, setSearch] = useState("")
  const [selectedPayroll, setSelectedPayroll] = useState<any>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)

  useEffect(() => {
    fetchPayroll()
    fetchEmployees()
  }, [])

  const filteredPayroll = (payroll || []).filter((slip) => {
    const matchesSearch = slip.profile?.full_name?.toLowerCase().includes(search.toLowerCase())
    const isNotDenied = slip.profile?.status !== 'denied'
    return matchesSearch && isNotDenied
  })

  const handleRunPayroll = () => {
    // Generate draft payroll for all employees based on their base salary
    const currentMonth = new Date().toLocaleString('default', { month: 'long' })
    const currentYear = new Date().getFullYear()

    // Filter out denied employees
    const activeEmployees = employees.filter(emp => emp.status === 'active')

    activeEmployees.forEach(emp => {
      // Check if already exists for this month
      if (!payroll.find(p => p.user_id === emp.id && p.month === currentMonth && p.year === currentYear)) {
        generatePayroll({
          user_id: emp.id,
          month: currentMonth,
          year: currentYear,
          basic_pay: emp.base_salary || 0,
          allowances: (emp.base_salary || 0) * 0.1, // Dummy 10% allowance
          deductions: (emp.base_salary || 0) * 0.05, // Dummy 5% deduction
          net_pay: (emp.base_salary || 0) + ((emp.base_salary || 0) * 0.1) - ((emp.base_salary || 0) * 0.05),
          status: 'draft'
        })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search payroll records..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2">
            <Filter className="h-4 w-4" /> Filter
          </Button>
          <Button onClick={handleRunPayroll} className="gap-2">
            <DollarSign className="h-4 w-4" /> Run {new Date().toLocaleString('default', { month: 'short' })} Payroll
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b border-border/50">
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Employee</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Period</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 text-right">Basic + Allowances</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 text-right">Deductions</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 text-right">Net Pay</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 text-center">Status</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-32">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-muted-foreground">Loading payroll data...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPayroll.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-32 text-muted-foreground font-medium">
                  No payroll records found. Run payroll to generate slips.
                </TableCell>
              </TableRow>
            ) : (
              filteredPayroll.map((slip) => (
                <TableRow key={slip.id} className="hover:bg-muted/20 transition-colors group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={slip.profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                          {slip.profile?.full_name?.charAt(0) || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-bold tracking-tight group-hover:text-primary transition-colors">
                        {slip.profile?.full_name || "Unknown"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-tight">
                      {slip.month} {slip.year}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-emerald-600">${slip.basic_pay.toLocaleString()}</span>
                      <span className="text-[10px] text-emerald-600/70">+${slip.allowances.toLocaleString()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-xs font-bold text-rose-600">-${slip.deductions.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm font-black text-foreground">${slip.net_pay.toLocaleString()}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={slip.status === 'paid' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                      {slip.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                        onClick={() => {
                          setSelectedPayroll(slip)
                          setIsFormOpen(true)
                        }}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:bg-primary/10">
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <PayrollForm 
            payrollRecord={selectedPayroll}
            onSuccess={() => {
              setIsFormOpen(false)
              fetchPayroll()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
