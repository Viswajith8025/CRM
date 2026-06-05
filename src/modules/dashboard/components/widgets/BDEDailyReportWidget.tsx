import { useState, useEffect, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Phone, Calendar, Users, TrendingUp, Handshake, AlertTriangle,
  Lightbulb, ClipboardList, ChevronDown, ChevronUp, CheckCircle,
  Loader2, BarChart2, UserPlus, MessageSquare, Target, Save, RotateCcw,
  History, Eye
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface ReportData {
  // Section 1
  total_calls_made: string
  meetings_scheduled: string
  meetings_completed: string
  followups_done: string
  // Section 2
  lead_name: string
  number_of_leads: string
  lead_source: string
  lead_status: string
  lead_remarks: string
  // Section 3
  deals_closed: string
  revenue_generated: string
  pipeline_value: string
  conversion_rate: string
  // Section 4
  new_clients_contacted: string
  existing_clients_followup: string
  key_discussion_points: string
  // Section 5
  referrals_received: string
  // Section 6
  challenges_faced: string
  // Section 7
  competitor_insights: string
  // Section 8
  next_day_plan: string
  // Section 9
  manager_remarks: string
}

const EMPTY: ReportData = {
  total_calls_made: '', meetings_scheduled: '', meetings_completed: '', followups_done: '',
  lead_name: '', number_of_leads: '', lead_source: '', lead_status: '', lead_remarks: '',
  deals_closed: '', revenue_generated: '', pipeline_value: '', conversion_rate: '',
  new_clients_contacted: '', existing_clients_followup: '', key_discussion_points: '',
  referrals_received: '',
  challenges_faced: '',
  competitor_insights: '',
  next_day_plan: '',
  manager_remarks: '',
}

interface Section {
  id: string
  label: string
  icon: React.ReactNode
  color: string
}

const SECTIONS: Section[] = [
  { id: 's1', label: 'Daily Activities', icon: <Phone className="h-4 w-4" />, color: 'blue' },
  { id: 's2', label: 'Lead Details', icon: <Users className="h-4 w-4" />, color: 'violet' },
  { id: 's3', label: 'Sales Performance', icon: <TrendingUp className="h-4 w-4" />, color: 'emerald' },
  { id: 's4', label: 'Client Interaction', icon: <Handshake className="h-4 w-4" />, color: 'cyan' },
  { id: 's5', label: 'Referrals', icon: <UserPlus className="h-4 w-4" />, color: 'amber' },
  { id: 's6', label: 'Challenges', icon: <AlertTriangle className="h-4 w-4" />, color: 'rose' },
  { id: 's7', label: 'Competitor Insights', icon: <Lightbulb className="h-4 w-4" />, color: 'orange' },
  { id: 's8', label: 'Next Day Plan', icon: <ClipboardList className="h-4 w-4" />, color: 'sky' },
  { id: 's9', label: 'Manager Remarks', icon: <MessageSquare className="h-4 w-4" />, color: 'slate' },
]

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-600',
  violet: 'bg-violet-100 text-violet-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  cyan: 'bg-cyan-100 text-cyan-600',
  amber: 'bg-amber-100 text-amber-600',
  rose: 'bg-rose-100 text-rose-600',
  orange: 'bg-orange-100 text-orange-600',
  sky: 'bg-sky-100 text-sky-600',
  slate: 'bg-slate-100 text-slate-600',
}

export function BDEDailyReportWidget() {
  const { profile } = useAuthStore()
  const [data, setData] = useState<ReportData>(EMPTY)
  const [openSection, setOpenSection] = useState<string>('s1')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [existingId, setExistingId] = useState<string | null>(null)
  const [reportDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [historyReports, setHistoryReports] = useState<any[]>([])
  const [selectedHistoryReport, setSelectedHistoryReport] = useState<any | null>(null)

  const fetchTodayReport = useCallback(async () => {
    if (!profile?.id || !profile?.organization_id) return
    setIsLoading(true)
    try {
      const { data: existing } = await supabase
        .from('bde_daily_reports')
        .select('*')
        .eq('employee_id', profile.id)
        .eq('report_date', reportDate)
        .maybeSingle()

      if (existing) {
        setExistingId(existing.id)
        setData({
          total_calls_made: existing.total_calls_made?.toString() || '',
          meetings_scheduled: existing.meetings_scheduled?.toString() || '',
          meetings_completed: existing.meetings_completed?.toString() || '',
          followups_done: existing.followups_done?.toString() || '',
          lead_name: existing.lead_name || '',
          number_of_leads: existing.number_of_leads?.toString() || '',
          lead_source: existing.lead_source || '',
          lead_status: existing.lead_status || '',
          lead_remarks: existing.lead_remarks || '',
          deals_closed: existing.deals_closed?.toString() || '',
          revenue_generated: existing.revenue_generated?.toString() || '',
          pipeline_value: existing.pipeline_value?.toString() || '',
          conversion_rate: existing.conversion_rate?.toString() || '',
          new_clients_contacted: existing.new_clients_contacted?.toString() || '',
          existing_clients_followup: existing.existing_clients_followup?.toString() || '',
          key_discussion_points: existing.key_discussion_points || '',
          referrals_received: existing.referrals_received?.toString() || '',
          challenges_faced: existing.challenges_faced || '',
          competitor_insights: existing.competitor_insights || '',
          next_day_plan: existing.next_day_plan || '',
          manager_remarks: existing.manager_remarks || '',
        })
      }
    } catch (err) {
      console.error('Failed to load today report:', err)
    } finally {
      setIsLoading(false)
    }
  }, [profile?.id, profile?.organization_id, reportDate])

  useEffect(() => {
    fetchTodayReport()
  }, [fetchTodayReport])

  const fetchHistory = async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('bde_daily_reports')
        .select('*')
        .eq('employee_id', profile.id)
        .order('report_date', { ascending: false })
        .limit(30)
      if (data) {
        setHistoryReports(data)
        setIsHistoryOpen(true)
      }
    } catch (err) {
      console.error('Failed to fetch history:', err)
    }
  }

  const set = (key: keyof ReportData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setData(prev => ({ ...prev, [key]: e.target.value }))
  }

  const handleSave = async () => {
    if (!profile?.id || !profile?.organization_id) return
    setIsSaving(true)
    try {
      const payload = {
        organization_id: profile.organization_id,
        employee_id: profile.id,
        report_date: reportDate,
        total_calls_made: parseInt(data.total_calls_made) || 0,
        meetings_scheduled: parseInt(data.meetings_scheduled) || 0,
        meetings_completed: parseInt(data.meetings_completed) || 0,
        followups_done: parseInt(data.followups_done) || 0,
        lead_name: data.lead_name || null,
        number_of_leads: parseInt(data.number_of_leads) || 0,
        lead_source: data.lead_source || null,
        lead_status: data.lead_status || null,
        lead_remarks: data.lead_remarks || null,
        deals_closed: parseInt(data.deals_closed) || 0,
        revenue_generated: parseFloat(data.revenue_generated) || 0,
        pipeline_value: parseFloat(data.pipeline_value) || 0,
        conversion_rate: parseFloat(data.conversion_rate) || 0,
        new_clients_contacted: parseInt(data.new_clients_contacted) || 0,
        existing_clients_followup: parseInt(data.existing_clients_followup) || 0,
        key_discussion_points: data.key_discussion_points || null,
        referrals_received: parseInt(data.referrals_received) || 0,
        challenges_faced: data.challenges_faced || null,
        competitor_insights: data.competitor_insights || null,
        next_day_plan: data.next_day_plan || null,
        manager_remarks: data.manager_remarks || null,
        updated_at: new Date().toISOString(),
      }

      if (existingId) {
        const { error } = await supabase
          .from('bde_daily_reports')
          .update(payload)
          .eq('id', existingId)
        if (error) throw error
        toast.success('Daily report updated!')
      } else {
        const { data: inserted, error } = await supabase
          .from('bde_daily_reports')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        setExistingId(inserted.id)
        toast.success('Daily report saved!')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save report')
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (!confirm('Clear all fields for today?')) return
    setData(EMPTY)
    setExistingId(null)
  }

  if (isLoading) {
    return (
      <Card className="bg-card/40 border-border/40 backdrop-blur-md shadow-sm flex items-center justify-center h-[540px]">
        <Loader2 className="h-7 w-7 text-primary animate-spin" />
      </Card>
    )
  }

  return (
    <Card className="bg-card/40 border-border/40 backdrop-blur-md shadow-sm overflow-hidden flex flex-col h-[540px]">
      {/* Header */}
      <CardHeader className="pb-3 border-b border-border/10 shrink-0 bg-gradient-to-r from-indigo-500/5 to-violet-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600">
              <BarChart2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700">
                BDE Daily Report
              </CardTitle>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">
                {format(new Date(), 'EEEE, dd MMM yyyy')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {existingId && (
              <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-600 px-2 py-1 rounded-full tracking-wider">
                ✓ Saved
              </span>
            )}
            <button
              onClick={fetchHistory}
              title="View History"
              className="p-1.5 text-slate-300 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
            >
              <History className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleReset}
              title="Reset form"
              className="p-1.5 text-slate-300 hover:text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </CardHeader>

      {/* Scrollable Accordion Body */}
      <CardContent className="p-0 flex-1 overflow-y-auto">
        <div className="divide-y divide-border/10">
          {SECTIONS.map((section) => (
            <AccordionSection
              key={section.id}
              section={section}
              isOpen={openSection === section.id}
              onToggle={() => setOpenSection(openSection === section.id ? '' : section.id)}
            >
              {section.id === 's1' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Total Calls Made" icon={<Phone className="h-3 w-3" />}>
                    <Input type="number" min="0" placeholder="0" value={data.total_calls_made} onChange={set('total_calls_made')} className="h-8 text-xs font-bold bg-muted/20" />
                  </Field>
                  <Field label="Meetings Scheduled">
                    <Input type="number" min="0" placeholder="0" value={data.meetings_scheduled} onChange={set('meetings_scheduled')} className="h-8 text-xs font-bold bg-muted/20" />
                  </Field>
                  <Field label="Meetings Completed">
                    <Input type="number" min="0" placeholder="0" value={data.meetings_completed} onChange={set('meetings_completed')} className="h-8 text-xs font-bold bg-muted/20" />
                  </Field>
                  <Field label="Follow-ups Done">
                    <Input type="number" min="0" placeholder="0" value={data.followups_done} onChange={set('followups_done')} className="h-8 text-xs font-bold bg-muted/20" />
                  </Field>
                </div>
              )}

              {section.id === 's2' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Lead Name">
                      <Input placeholder="e.g. SMM" value={data.lead_name} onChange={set('lead_name')} className="h-8 text-xs font-bold bg-muted/20" />
                    </Field>
                    <Field label="No. of Leads">
                      <Input type="number" min="0" placeholder="0" value={data.number_of_leads} onChange={set('number_of_leads')} className="h-8 text-xs font-bold bg-muted/20" />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Source">
                      <Input placeholder="e.g. Ad, Referral" value={data.lead_source} onChange={set('lead_source')} className="h-8 text-xs font-bold bg-muted/20" />
                    </Field>
                    <Field label="Status">
                      <select
                        value={data.lead_status}
                        onChange={set('lead_status')}
                        className="w-full h-8 text-xs font-bold bg-muted/20 border border-input rounded-md px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">Select status</option>
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="interested">Interested</option>
                        <option value="negotiating">Negotiating</option>
                        <option value="converted">Converted</option>
                        <option value="lost">Lost</option>
                      </select>
                    </Field>
                  </div>
                  <Field label="Remarks">
                    <Textarea placeholder="Any notes about this lead..." value={data.lead_remarks} onChange={set('lead_remarks')} rows={2} className="text-xs font-bold bg-muted/20 resize-none" />
                  </Field>
                </div>
              )}

              {section.id === 's3' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Deals Closed">
                    <Input type="number" min="0" placeholder="0" value={data.deals_closed} onChange={set('deals_closed')} className="h-8 text-xs font-bold bg-muted/20" />
                  </Field>
                  <Field label="Conversion Rate (%)">
                    <Input type="number" min="0" max="100" placeholder="0" value={data.conversion_rate} onChange={set('conversion_rate')} className="h-8 text-xs font-bold bg-muted/20" />
                  </Field>
                  <Field label="Revenue Generated (₹)">
                    <Input type="number" min="0" placeholder="0.00" value={data.revenue_generated} onChange={set('revenue_generated')} className="h-8 text-xs font-bold bg-muted/20" />
                  </Field>
                  <Field label="Pipeline Value (₹)">
                    <Input type="number" min="0" placeholder="0.00" value={data.pipeline_value} onChange={set('pipeline_value')} className="h-8 text-xs font-bold bg-muted/20" />
                  </Field>
                </div>
              )}

              {section.id === 's4' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="New Clients Contacted">
                      <Input type="number" min="0" placeholder="0" value={data.new_clients_contacted} onChange={set('new_clients_contacted')} className="h-8 text-xs font-bold bg-muted/20" />
                    </Field>
                    <Field label="Existing Clients Followed Up">
                      <Input type="number" min="0" placeholder="0" value={data.existing_clients_followup} onChange={set('existing_clients_followup')} className="h-8 text-xs font-bold bg-muted/20" />
                    </Field>
                  </div>
                  <Field label="Key Discussion Points">
                    <Textarea placeholder="What was discussed with clients today?" value={data.key_discussion_points} onChange={set('key_discussion_points')} rows={2} className="text-xs font-bold bg-muted/20 resize-none" />
                  </Field>
                </div>
              )}

              {section.id === 's5' && (
                <Field label="Referrals Received">
                  <Input type="number" min="0" placeholder="0" value={data.referrals_received} onChange={set('referrals_received')} className="h-8 text-xs font-bold bg-muted/20 max-w-[160px]" />
                </Field>
              )}

              {section.id === 's6' && (
                <Textarea
                  placeholder="Describe any issues or blockers you faced today..."
                  value={data.challenges_faced}
                  onChange={set('challenges_faced')}
                  rows={3}
                  className="text-xs font-bold bg-muted/20 resize-none w-full"
                />
              )}

              {section.id === 's7' && (
                <Textarea
                  placeholder="Any market feedback or competitor activity observed..."
                  value={data.competitor_insights}
                  onChange={set('competitor_insights')}
                  rows={3}
                  className="text-xs font-bold bg-muted/20 resize-none w-full"
                />
              )}

              {section.id === 's8' && (
                <Textarea
                  placeholder="What are you planning for tomorrow / next week?"
                  value={data.next_day_plan}
                  onChange={set('next_day_plan')}
                  rows={3}
                  className="text-xs font-bold bg-muted/20 resize-none w-full"
                />
              )}

              {section.id === 's9' && (
                <Textarea
                  placeholder="Manager's comments or feedback..."
                  value={data.manager_remarks}
                  onChange={set('manager_remarks')}
                  rows={3}
                  className="text-xs font-bold bg-muted/20 resize-none w-full"
                />
              )}
            </AccordionSection>
          ))}
        </div>
      </CardContent>

      {/* Save Footer */}
      <div className="shrink-0 p-3 border-t border-border/10 bg-muted/20">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full font-black uppercase tracking-widest text-xs gap-2 bg-indigo-600 hover:bg-indigo-700 text-white h-9"
        >
          {isSaving ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Saving Report...</>
          ) : (
            <><Save className="h-4 w-4" /> {existingId ? 'Update Report' : 'Save Daily Report'}</>
          )}
        </Button>
      </div>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>BDE Reports History</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 flex gap-4">
            <div className="w-1/3 border-r border-border/50 pr-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Past 30 Days</h3>
              {historyReports.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No past reports found.</p>
              ) : (
                historyReports.map(report => (
                  <button
                    key={report.id}
                    onClick={() => setSelectedHistoryReport(report)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all text-xs flex justify-between items-center",
                      selectedHistoryReport?.id === report.id
                        ? "bg-indigo-50 border-indigo-200 text-indigo-900 font-bold shadow-sm"
                        : "bg-muted/30 border-border/40 hover:bg-muted/60"
                    )}
                  >
                    <span>{format(new Date(report.report_date), 'MMM dd, yyyy')}</span>
                    <ChevronDown className="h-3 w-3 -rotate-90 opacity-50" />
                  </button>
                ))
              )}
            </div>
            <div className="w-2/3 pl-2 overflow-y-auto">
              {!selectedHistoryReport ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                  Select a date to view the report
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-indigo-50 p-4 rounded-xl">
                    <span className="font-bold text-indigo-900">
                      Report for {format(new Date(selectedHistoryReport.report_date), 'MMMM do, yyyy')}
                    </span>
                    <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-700">
                      Archived
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="shadow-none border-border/50 bg-muted/20">
                      <CardContent className="p-3 space-y-1.5 text-xs">
                        <p className="font-bold border-b pb-1 mb-1.5 text-muted-foreground uppercase tracking-widest text-[9px]">Activity</p>
                        <p>Calls: <b>{selectedHistoryReport.total_calls_made}</b></p>
                        <p>Meetings: <b>{selectedHistoryReport.meetings_completed}</b> / {selectedHistoryReport.meetings_scheduled}</p>
                        <p>Follow-ups: <b>{selectedHistoryReport.followups_done}</b></p>
                      </CardContent>
                    </Card>

                    <Card className="shadow-none border-border/50 bg-muted/20">
                      <CardContent className="p-3 space-y-1.5 text-xs">
                        <p className="font-bold border-b pb-1 mb-1.5 text-muted-foreground uppercase tracking-widest text-[9px]">Sales</p>
                        <p>Deals: <b>{selectedHistoryReport.deals_closed}</b></p>
                        <p>Revenue: <b>₹{selectedHistoryReport.revenue_generated}</b></p>
                        <p>Pipeline: <b>₹{selectedHistoryReport.pipeline_value}</b></p>
                        <p>Conversion: <b>{selectedHistoryReport.conversion_rate}%</b></p>
                      </CardContent>
                    </Card>

                    <Card className="shadow-none border-border/50 bg-muted/20 col-span-2">
                      <CardContent className="p-3 space-y-1.5 text-xs">
                        <p className="font-bold border-b pb-1 mb-1.5 text-muted-foreground uppercase tracking-widest text-[9px]">Lead Details</p>
                        <div className="grid grid-cols-2 gap-2">
                          <p>Name: <b>{selectedHistoryReport.lead_name || '-'}</b></p>
                          <p>Source: <b>{selectedHistoryReport.lead_source || '-'}</b></p>
                          <p>Status: <b className="capitalize">{selectedHistoryReport.lead_status || '-'}</b></p>
                          <p>Count: <b>{selectedHistoryReport.number_of_leads}</b></p>
                        </div>
                        {selectedHistoryReport.lead_remarks && <p className="italic text-muted-foreground mt-1">"{selectedHistoryReport.lead_remarks}"</p>}
                      </CardContent>
                    </Card>

                    <Card className="shadow-none border-border/50 bg-muted/20 col-span-2">
                      <CardContent className="p-3 space-y-1.5 text-xs">
                        <p className="font-bold border-b pb-1 mb-1.5 text-muted-foreground uppercase tracking-widest text-[9px]">Client Interactions</p>
                        <div className="grid grid-cols-2 gap-2">
                          <p>New Clients: <b>{selectedHistoryReport.new_clients_contacted}</b></p>
                          <p>Existing Follow-ups: <b>{selectedHistoryReport.existing_clients_followup}</b></p>
                          <p>Referrals: <b>{selectedHistoryReport.referrals_received}</b></p>
                        </div>
                        {selectedHistoryReport.key_discussion_points && (
                          <div className="mt-2"><p className="font-bold text-[10px] text-muted-foreground">Discussion Points:</p><p className="whitespace-pre-wrap">{selectedHistoryReport.key_discussion_points}</p></div>
                        )}
                      </CardContent>
                    </Card>

                    {(selectedHistoryReport.challenges_faced || selectedHistoryReport.competitor_insights || selectedHistoryReport.next_day_plan || selectedHistoryReport.manager_remarks) && (
                      <Card className="shadow-none border-border/50 bg-indigo-50/30 col-span-2">
                        <CardContent className="p-3 space-y-3 text-xs">
                          {selectedHistoryReport.challenges_faced && (
                            <div><p className="font-bold text-[10px] text-rose-500 uppercase tracking-widest">Challenges</p><p className="whitespace-pre-wrap">{selectedHistoryReport.challenges_faced}</p></div>
                          )}
                          {selectedHistoryReport.competitor_insights && (
                            <div><p className="font-bold text-[10px] text-orange-500 uppercase tracking-widest">Competitor Insights</p><p className="whitespace-pre-wrap">{selectedHistoryReport.competitor_insights}</p></div>
                          )}
                          {selectedHistoryReport.next_day_plan && (
                            <div><p className="font-bold text-[10px] text-sky-600 uppercase tracking-widest">Next Day Plan</p><p className="whitespace-pre-wrap">{selectedHistoryReport.next_day_plan}</p></div>
                          )}
                          {selectedHistoryReport.manager_remarks && (
                            <div><p className="font-bold text-[10px] text-slate-500 uppercase tracking-widest">Manager Remarks</p><p className="whitespace-pre-wrap italic text-slate-700 bg-white/50 p-2 rounded">"{selectedHistoryReport.manager_remarks}"</p></div>
                          )}
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}


// Accordion Section Component
function AccordionSection({
  section, isOpen, onToggle, children
}: {
  section: Section
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-left transition-colors",
          isOpen ? "bg-muted/40" : "hover:bg-muted/20"
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className={cn("p-1.5 rounded-lg text-xs", COLOR_MAP[section.color])}>
            {section.icon}
          </span>
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-700">
            {section.label}
          </span>
        </div>
        {isOpen
          ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        }
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 bg-white/60 dark:bg-black/10 border-t border-border/5">
          {children}
        </div>
      )}
    </div>
  )
}

// Reusable field wrapper
function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </label>
      {children}
    </div>
  )
}
