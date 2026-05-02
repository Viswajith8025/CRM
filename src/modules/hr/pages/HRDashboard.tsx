import { PageWrapper } from "@/components/shared/PageWrapper"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EmployeeDirectory } from "../components/EmployeeDirectory"
import { AttendanceLeave } from "../components/AttendanceLeave"
import { PayrollSystem } from "../components/PayrollSystem"
import { Users, Clock, DollarSign } from "lucide-react"

export default function HRDashboard() {
  return (
    <PageWrapper 
      title="HR & Employee Management" 
      description="Manage your team, track attendance, approve leaves, and generate payroll."
    >
      <Tabs defaultValue="directory" className="mt-6">
        <TabsList className="grid grid-cols-3 max-w-md mb-6">
          <TabsTrigger value="directory" className="gap-2 text-xs">
            <Users className="h-3.5 w-3.5" /> Directory
          </TabsTrigger>
          <TabsTrigger value="attendance" className="gap-2 text-xs">
            <Clock className="h-3.5 w-3.5" /> Time & Leave
          </TabsTrigger>
          <TabsTrigger value="payroll" className="gap-2 text-xs">
            <DollarSign className="h-3.5 w-3.5" /> Payroll
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="directory" className="m-0">
          <EmployeeDirectory />
        </TabsContent>
        
        <TabsContent value="attendance" className="m-0">
          <AttendanceLeave />
        </TabsContent>
        
        <TabsContent value="payroll" className="m-0">
          <PayrollSystem />
        </TabsContent>
      </Tabs>
    </PageWrapper>
  )
}
