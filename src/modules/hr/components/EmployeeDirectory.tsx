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
import { Search, Mail, Briefcase, TrendingUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { useHRStore } from "../hrStore"
import { format } from "date-fns"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog"
import { EmployeeForm } from "./EmployeeForm"
import { Plus, Edit2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export function EmployeeDirectory() {
  const { employees, fetchEmployees, isLoading } = useHRStore()
  const [search, setSearch] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState<HREmployee | undefined>()
  const [isFormOpen, setIsFormOpen] = useState(false)

  useEffect(() => {
    fetchEmployees()
  }, [])

  const filteredEmployees = employees.filter((emp) =>
    emp.profile?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    emp.department?.toLowerCase().includes(search.toLowerCase()) ||
    emp.designation?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees by name, department, or designation..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        <Button variant="outline" size="sm" onClick={() => fetchEmployees()}>
          Refresh Directory
        </Button>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Employee Details</DialogTitle>
              <DialogDescription>
                Set professional roles, departments, and base salaries for your team members.
              </DialogDescription>
            </DialogHeader>
            <EmployeeForm 
              employee={selectedEmployee} 
              onSuccess={() => {
                setIsFormOpen(false)
                fetchEmployees()
              }} 
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 border-b border-border/50">
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Employee</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Department & Role</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">Join Date</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4">KPI Score</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 text-right">Base Salary</TableHead>
              <TableHead className="font-black uppercase tracking-widest text-[10px] text-muted-foreground py-4 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32">
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-bold text-muted-foreground">Loading employee directory...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32 text-muted-foreground font-medium">
                  No employees found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((emp) => (
                <TableRow key={emp.id} className="hover:bg-muted/20 transition-colors group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border-2 border-background shadow-sm">
                        <AvatarImage src={emp.profile?.avatar_url || ""} />
                        <AvatarFallback className="bg-primary/10 text-primary font-black text-xs">
                          {emp.profile?.full_name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold tracking-tight group-hover:text-primary transition-colors">
                          {emp.profile?.full_name || "Unknown"}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          <Mail className="h-2.5 w-2.5" />
                          {emp.profile?.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-muted-foreground" />
                        {emp.designation || "Not Set"}
                      </span>
                      <Badge variant="secondary" className="w-fit text-[9px] uppercase tracking-wider">
                        {emp.department || "No Dept"}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-tight">
                      {emp.join_date ? format(new Date(emp.join_date), 'MMM d, yyyy') : "N/A"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-500" />
                      <span className="font-bold">{emp.kpi_score}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">
                    ${emp.base_salary?.toLocaleString() || "0"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                      onClick={() => {
                        setSelectedEmployee(emp)
                        setIsFormOpen(true)
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
