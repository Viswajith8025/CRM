import { useState, useEffect } from "react"
import { useBDEReportStore } from "../bdeReportStore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Users, Calendar, Download } from "lucide-react"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function BDEReportsAdminView() {
  const { reports, fetchAllReports, isLoading } = useBDEReportStore()
  const [days, setDays] = useState(7)

  useEffect(() => {
    const start = new Date()
    start.setDate(start.getDate() - days)
    fetchAllReports(start.toISOString().split('T')[0], new Date().toISOString().split('T')[0])
  }, [days])

  return (
    <Card className="mt-8 border-border/50 bg-card/40 backdrop-blur-md">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-border/10 pb-4">
        <div>
          <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            BDE Daily Reports (Admin View)
          </CardTitle>
          <CardDescription className="text-[10px] uppercase font-bold mt-1">Monitor all Business Development Executives</CardDescription>
        </div>
        
        <div className="flex gap-2">
          <Button variant={days === 0 ? "default" : "outline"} size="sm" onClick={() => setDays(0)} className="h-7 text-[10px]">Today</Button>
          <Button variant={days === 7 ? "default" : "outline"} size="sm" onClick={() => setDays(7)} className="h-7 text-[10px]">Last 7 Days</Button>
          <Button variant={days === 30 ? "default" : "outline"} size="sm" onClick={() => setDays(30)} className="h-7 text-[10px]">Last 30 Days</Button>
        </div>
      </CardHeader>
      
      <CardContent className="pt-6">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : reports.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs font-bold uppercase">No BDE reports found for this period.</div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-[10px] font-black uppercase">Date</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">BDE Name</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Status</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Leads Target</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Meetings</TableHead>
                  <TableHead className="text-[10px] font-black uppercase">Calls</TableHead>
                  <TableHead className="text-[10px] font-black uppercase text-right">Collected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium whitespace-nowrap">{format(new Date(r.report_date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-bold">{r.users?.full_name || r.users?.email || 'Unknown User'}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === 'completed' ? "default" : "secondary"} className={`text-[9px] ${r.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30' : ''}`}>
                        {r.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      SM: {r.leads_social_media} | JD: {r.leads_just_dial} | Oth: {r.leads_other}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.status === 'completed' ? `${r.meetings_attended} / ${r.meetings_scheduled}` : r.meetings_scheduled}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.calls_connected ?? '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-500">
                      {r.amount_collected ? `$${r.amount_collected}` : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
