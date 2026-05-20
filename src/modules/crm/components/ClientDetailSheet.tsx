import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  User, Mail, Phone, Globe, MapPin, Briefcase,
  DollarSign, CheckCircle, Clock, AlertCircle, FileText,
  TrendingUp, CreditCard, ReceiptText
} from 'lucide-react'
import type { Client } from '../types'

interface ClientDetailSheetProps {
  client: Client | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface SubmissionWithFinancials {
  id: string
  status: string
  completion_rate: number
  updated_at: string
  financial_data: {
    project_cost: number
    paid_amount: number
    balance: number
    payment_status: 'unpaid' | 'partial' | 'paid'
    notes: string
  } | null
  template: { name: string; service_type: string } | null
  answers: { field_id: string; answer_value?: string; answer_encrypted?: string }[]
  template_sections: {
    id: string
    title: string
    fields: { id: string; label: string; field_type: string; is_sensitive: boolean }[]
  }[]
}

export function ClientDetailSheet({ client, open, onOpenChange }: ClientDetailSheetProps) {
  const [submission, setSubmission] = useState<SubmissionWithFinancials | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!client || !open) return
    setSubmission(null)
    setIsLoading(true)

    supabase
      .from('form_submissions')
      .select(`
        id,
        status,
        completion_rate,
        updated_at,
        financial_data,
        template:form_templates (
          name,
          service_type,
          sections:form_sections (
            id,
            title,
            sort_order,
            fields:form_fields (id, label, field_type, is_sensitive, sort_order)
          )
        ),
        answers:form_submission_answers (field_id, answer_value, answer_encrypted)
      `)
      .eq('client_id', client.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error(error) }
        if (data) {
          const t = data.template as any
          setSubmission({
            ...data,
            financial_data: (data as any).financial_data || null,
            template: t ? { name: t.name, service_type: t.service_type } : null,
            template_sections: (t?.sections || [])
              .sort((a: any, b: any) => a.sort_order - b.sort_order)
              .map((s: any) => ({
                id: s.id,
                title: s.title,
                fields: (s.fields || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
              })),
            answers: (data as any).answers || []
          })
        }
        setIsLoading(false)
      })
  }, [client, open])

  const paymentBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      partial: 'bg-amber-50 text-amber-700 border-amber-200',
      unpaid: 'bg-rose-50 text-rose-700 border-rose-200'
    }
    return map[status] || 'bg-slate-50 text-slate-600 border-slate-200'
  }

  const answersMap = new Map(submission?.answers?.map(a => [a.field_id, a]) || [])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="p-6 pb-4 border-b bg-slate-900 text-white rounded-tl-none">
          <SheetTitle className="text-white text-xl font-black tracking-tight">
            {client?.name}
          </SheetTitle>
          <SheetDescription className="text-slate-400 text-xs">
            Full client profile — contact details, financials, and submitted form data.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">

            {/* ── Contact Info ── */}
            <section className="space-y-3">
              <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest">Contact Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { icon: Mail, label: 'Email', value: client?.email },
                  { icon: Phone, label: 'Phone', value: client?.phone },
                  { icon: Globe, label: 'Website', value: client?.website },
                  { icon: MapPin, label: 'Address', value: client?.address },
                  { icon: Briefcase, label: 'Service', value: client?.service },
                ].map(({ icon: Icon, label, value }) =>
                  value ? (
                    <div key={label} className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <div className="p-1.5 bg-white rounded-xl border border-slate-200 mt-0.5">
                        <Icon className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
                        <span className="text-xs font-semibold text-slate-800">{value}</span>
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            </section>

            {/* ── Financial Summary ── */}
            {submission?.financial_data ? (
              <section className="space-y-3">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" /> Project Financials
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-0.5">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Project Cost</span>
                    <div className="text-lg font-black text-slate-900 font-mono">
                      &#8377;{submission.financial_data.project_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-0.5">
                    <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">Paid</span>
                    <div className="text-lg font-black text-emerald-700 font-mono">
                      &#8377;{submission.financial_data.paid_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className={`p-3 rounded-2xl border space-y-0.5 ${submission.financial_data.balance > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <span className={`text-[10px] font-extrabold uppercase tracking-wider ${submission.financial_data.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Balance</span>
                    <div className={`text-lg font-black font-mono ${submission.financial_data.balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                      &#8377;{submission.financial_data.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${paymentBadge(submission.financial_data.payment_status)}`}>
                    <CreditCard className="h-3 w-3" />
                    {submission.financial_data.payment_status === 'paid' ? 'Fully Paid'
                      : submission.financial_data.payment_status === 'partial' ? 'Partially Paid'
                      : 'Unpaid'}
                  </span>
                  {submission.financial_data.notes && (
                    <span className="text-xs text-slate-500 italic truncate max-w-xs">
                      {submission.financial_data.notes}
                    </span>
                  )}
                </div>
              </section>
            ) : (
              <section className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                <span className="text-xs text-amber-700 font-medium">No financial data entered yet. Open the submission review to add it.</span>
              </section>
            )}

            {/* ── Form Submission Data ── */}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-5 w-5 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-2" />
                <span className="text-xs text-slate-500">Loading submission data...</span>
              </div>
            ) : submission ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5" /> Submitted Form Answers
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    submission.status === 'approved'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-sky-50 text-sky-700 border-sky-200'
                  }`}>
                    {submission.status.replace('_', ' ')}
                  </span>
                </div>

                {submission.template_sections.map(section => (
                  <div key={section.id} className="rounded-2xl border border-slate-100 overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100">
                      <span className="text-xs font-black text-slate-700">{section.title}</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {section.fields.map(field => {
                        const answer = answersMap.get(field.id)
                        const val = field.is_sensitive ? '••••••••' : (answer?.answer_value || '—')
                        return (
                          <div key={field.id} className="px-4 py-3 grid grid-cols-2 gap-2">
                            <span className="text-[11px] font-bold text-slate-500">{field.label}</span>
                            <span className={`text-[11px] font-semibold text-right ${val === '—' ? 'text-slate-300 italic' : 'text-slate-800'}`}>
                              {val}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </section>
            ) : (
              <section className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3">
                <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="text-xs text-slate-500 font-medium">No onboarding submission linked to this client.</span>
              </section>
            )}

          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
