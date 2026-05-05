import { useState, useEffect } from "react"
import { useHRStore } from "../hrStore"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { Clock, Calendar, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog"
import { LeaveRequestForm } from "./LeaveRequestForm"

export function AttendanceLeave() {
  const { attendance, leaves, fetchAttendance, fetchLeaves, clockIn, clockOut, updateLeaveStatus, isLoading } = useHRStore()
  const [isLeaveOpen, setIsLeaveOpen] = useState(false)
  
  useEffect(() => {
    fetchAttendance()
    fetchLeaves()
  }, [])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      {/* ATTENDANCE SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Daily Attendance
          </h3>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => clockIn()}>Clock In</Button>
          </div>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {isLoading && attendance.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading attendance...</div>
          ) : attendance.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No attendance records found.</div>
          ) : (
            <div className="divide-y">
              {attendance.map((record) => (
                <div key={record.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={record.profile?.avatar_url || ""} />
                      <AvatarFallback>{record.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-bold">{record.profile?.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(record.date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-xs font-medium text-emerald-600">IN: {record.clock_in ? format(new Date(record.clock_in), 'p') : '--:--'}</p>
                      <p className="text-xs font-medium text-rose-600">OUT: {record.clock_out ? format(new Date(record.clock_out), 'p') : '--:--'}</p>
                    </div>
                    {record.clock_in && !record.clock_out ? (
                      <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => clockOut(record.id)}>
                        Clock Out
                      </Button>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {record.status}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LEAVES SECTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Leave Requests
          </h3>
          
          <Dialog open={isLeaveOpen} onOpenChange={setIsLeaveOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="secondary">Request Leave</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit Leave Request</DialogTitle>
                <DialogDescription>
                  Request time off for approval by HR.
                </DialogDescription>
              </DialogHeader>
              <LeaveRequestForm onSuccess={() => {
                setIsLeaveOpen(false)
                fetchLeaves()
              }} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="rounded-xl border bg-card overflow-hidden">
          {isLoading && leaves.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading leaves...</div>
          ) : leaves.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No leave requests found.</div>
          ) : (
            <div className="divide-y">
              {leaves.map((leave) => (
                <div key={leave.id} className="p-4 flex flex-col gap-3 hover:bg-muted/30 transition-colors">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={leave.profile?.avatar_url || ""} />
                        <AvatarFallback>{leave.profile?.full_name?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-bold">{leave.profile?.full_name}</p>
                        <Badge variant="outline" className="text-[9px] uppercase mt-0.5">{leave.leave_type} LEAVE</Badge>
                      </div>
                    </div>
                    
                    {leave.status === 'pending' ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50" onClick={() => updateLeaveStatus(leave.id, 'approved')}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => updateLeaveStatus(leave.id, 'rejected')}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Badge variant={leave.status === 'approved' ? 'default' : 'destructive'} className="text-[10px] uppercase">
                        {leave.status}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="bg-muted/30 p-2 rounded text-xs flex items-center justify-between border">
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">{format(new Date(leave.start_date), 'MMM d')}</span> to <span className="font-medium text-foreground">{format(new Date(leave.end_date), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground italic truncate max-w-[200px]">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {leave.reason || 'No reason provided'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
