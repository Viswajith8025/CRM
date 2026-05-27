import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'
import { useTeamStore } from '@/modules/admin/teamStore'
import { useFormsStore } from '../formsStore'
import {
  ArrowLeft, Calendar, FileText, CheckCircle,
  User, Building2, Download, Eye, EyeOff, Send, Check, ShieldCheck,
  RefreshCw, Paperclip
} from 'lucide-react'
import { format } from 'date-fns'

export default function SubmissionReview() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    currentSubmission,
    getSubmissionById,
    updateSubmissionStatus,
    fetchAttachments,
    saveFinancialData,
    approveAndConvertToClient
  } = useFormsStore()
  const { profile } = useAuthStore()
  const { members, fetchMembers } = useTeamStore()
  const [attachments, setAttachments] = useState<any[]>([])

  // Authorization Check
  const userRole = profile?.role || ''
  const dynamicRole = (profile?.dynamic_role || '').toLowerCase()
  const canApprove = ['super_admin', 'admin', 'manager'].includes(userRole) || 
                     ['hr', 'sales', 'sales person'].includes(dynamicRole)


  // Status Update State
  const [isUpdating, setIsUpdating] = useState(false)
  const [newStatus, setNewStatus] = useState<any>('')
  const [clarificationNotes, setClarificationNotes] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Financial Data State
  const [projectCost, setProjectCost] = useState('')
  const [paidAmount, setPaidAmount] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'partial' | 'paid'>('unpaid')
  const [financialNotes, setFinancialNotes] = useState('')
  const [salesRepId, setSalesRepId] = useState('')
  const [remarks, setRemarks] = useState('')
  const [isSavingFinancials, setIsSavingFinancials] = useState(false)
  const [financialSuccess, setFinancialSuccess] = useState('')
  const [isConverting, setIsConverting] = useState(false)
  const [convertSuccess, setConvertSuccess] = useState('')

  // Sensitive values visibility mapping
  const [revealedSensitives, setRevealedSensitives] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (id) {
      getSubmissionById(id)
      fetchAttachments(id).then(setAttachments)
    }
    fetchMembers()
  }, [id])

  useEffect(() => {
    if (currentSubmission) {
      setNewStatus(currentSubmission.status)
      setClarificationNotes(currentSubmission.clarification_notes || '')
      const fd = currentSubmission.financial_data
      if (fd) {
        setProjectCost(fd.project_cost?.toString() || '')
        setPaidAmount(fd.paid_amount?.toString() || '')
        setPaymentStatus(fd.payment_status || 'unpaid')
        setFinancialNotes(fd.notes || '')
        setSalesRepId(fd.sales_rep_id || '')
        setRemarks(fd.remarks || '')
      }
    }
  }, [currentSubmission])

  const cost = parseFloat(projectCost) || 0
  const paid = parseFloat(paidAmount) || 0
  const balance = Math.max(0, cost - paid)

  if (!currentSubmission) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-500 text-sm font-medium">
        <div className="h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
        Securing Submission Data...
      </div>
    )
  }

  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setIsUpdating(true)
    try {
      await updateSubmissionStatus(id, newStatus, clarificationNotes || undefined)
      setSuccessMessage('Submission status successfully updated!')
      setTimeout(() => setSuccessMessage(''), 4000)
      await getSubmissionById(id)
    } catch (err) {
      console.error(err)
      alert('Failed to update submission status.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveFinancials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setIsSavingFinancials(true)
    try {
      await saveFinancialData(id, {
        project_cost: cost,
        paid_amount: paid,
        balance,
        payment_status: paymentStatus,
        notes: financialNotes,
        sales_rep_id: salesRepId || undefined,
        remarks: remarks || undefined
      })
      setFinancialSuccess('Financial data saved successfully!')
      setTimeout(() => setFinancialSuccess(''), 4000)
    } catch (err) {
      alert('Failed to save financial data.')
    } finally {
      setIsSavingFinancials(false)
    }
  }

  const handleApproveAndConvert = async () => {
    if (!id) return
    if (!window.confirm('Approve this submission and add client to Active Clients?')) return
    setIsConverting(true)
    try {
      await approveAndConvertToClient(id)
      setConvertSuccess('Client successfully added to Active Clients!')
      setTimeout(() => setConvertSuccess(''), 6000)
    } catch (err: any) {
      alert(err.message || 'Failed to convert to client.')
    } finally {
      setIsConverting(false)
    }
  }

  const toggleRevealSensitive = (fieldId: string) => {
    setRevealedSensitives(prev => ({ ...prev, [fieldId]: !prev[fieldId] }))
  }

  const sections = currentSubmission.template?.sections || []
  const answersMap = new Map(currentSubmission.answers?.map(a => [a.field_id, a]))
  const attachmentsMap = new Map(attachments.map(a => [a.field_id, a]))

  const getStatusBadge = (status: string) => {
    const base = 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border '
    switch (status) {
      case 'approved': return base + 'bg-emerald-50 text-emerald-700 border-emerald-100'
      case 'submitted': return base + 'bg-sky-50 text-sky-700 border-sky-100'
      case 'clarification_needed': return base + 'bg-amber-50 text-amber-700 border-amber-100'
      default: return base + 'bg-slate-50 text-slate-600 border-slate-100'
    }
  }

  const paymentStatusColor: Record<string, string> = {
    unpaid: 'bg-rose-50 text-rose-700 border-rose-200',
    partial: 'bg-amber-50 text-amber-700 border-amber-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto animate-fade-in">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/crm/onboarding')}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Intake Manager
        </button>
        <span className="text-xs font-medium text-slate-400">
          UUID: <span className="font-mono">{currentSubmission.id}</span>
        </span>
      </div>

      {/* Main Header Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-8 rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-xl flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30">
                {currentSubmission.template?.service_type || 'Service Intake'}
              </span>
              <span className={getStatusBadge(currentSubmission.status)}>
                {currentSubmission.status.replace('_', ' ')}
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">{currentSubmission.template?.name || 'Onboarding Submission'}</h1>
            <p className="text-slate-400 text-sm">{currentSubmission.template?.description || 'Review client onboarding dynamic specification.'}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-4 border-t border-slate-800/80 text-xs">
            <div className="space-y-1">
              <span className="text-slate-500 font-medium">Assigned Path</span>
              <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                {currentSubmission.lead_id ? (
                  <><User className="h-3.5 w-3.5 text-sky-400" /> CRM Lead</>
                ) : (
                  <><Building2 className="h-3.5 w-3.5 text-sky-400" /> Active Client</>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-slate-500 font-medium">Completion</span>
              <div className="flex items-center gap-2">
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-sky-500" style={{ width: `${currentSubmission.completion_rate}%` }}></div>
                </div>
                <span className="text-slate-200 font-bold">{Math.round(currentSubmission.completion_rate)}%</span>
              </div>
            </div>
            <div className="space-y-1 col-span-2 md:col-span-1">
              <span className="text-slate-500 font-medium">Last Updated</span>
              <div className="flex items-center gap-1.5 text-slate-200 font-bold">
                <Calendar className="h-3.5 w-3.5 text-sky-400" />
                {format(new Date(currentSubmission.updated_at), 'MMM dd, yyyy h:mm a')}
              </div>
            </div>
          </div>
        </div>

        {/* Status Action Panel */}
        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col justify-between">
          <form onSubmit={handleStatusChange} className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-50 pb-2">
              <h3 className="font-black text-slate-900 text-sm">Update Intake Status</h3>
              <span className="text-[10px] font-bold text-slate-400">WORKFLOW ACTION</span>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">New Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
              >
                <option value="draft">Draft</option>
                <option value="submitted">Submitted (Needs Review)</option>
                <option value="clarification_needed">Clarification Needed</option>
                <option value="approved">Approved &amp; Finalized</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Review Notes</label>
              <textarea
                value={clarificationNotes}
                onChange={(e) => setClarificationNotes(e.target.value)}
                placeholder="Request clarifications or add review notes..."
                rows={3}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white resize-none"
              />
            </div>
            {successMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />{successMessage}
              </div>
            )}
            <button
              type="submit"
              disabled={isUpdating}
              className="w-full py-3 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {isUpdating ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Save Status Updates
            </button>
          </form>
        </div>
      </div>

      {/* ─── FINANCIAL DATA SECTION (Sales Person Input) ─── */}
      <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-black text-slate-900">Project Financials</h2>
            <p className="text-xs text-slate-500 mt-0.5">Filled in by the sales person. Stored with the client record.</p>
          </div>
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-sky-600 bg-sky-50 border border-sky-100 px-2.5 py-1 rounded-full">
            SALES INPUT
          </span>
        </div>

        {/* Live Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Project Cost</span>
            <div className="text-2xl font-black text-slate-900 font-mono">
              &#8377;{cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
            <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">Paid Amount</span>
            <div className="text-2xl font-black text-emerald-700 font-mono">
              &#8377;{paid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className={`p-4 rounded-2xl border space-y-1 ${balance > 0 ? 'bg-rose-50 border-rose-200' : 'bg-emerald-50 border-emerald-200'}`}>
            <span className={`text-[10px] font-extrabold uppercase tracking-wider ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              Balance Due
            </span>
            <div className={`text-2xl font-black font-mono ${balance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              &#8377;{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveFinancials} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Project Cost (&#8377;)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={projectCost}
                onChange={e => setProjectCost(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Paid Amount (&#8377;)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Balance (Auto-calculated)</label>
              <div className={`w-full px-4 py-2.5 rounded-2xl border text-sm font-mono font-bold ${balance > 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                &#8377;{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Payment Status</label>
              <select
                value={paymentStatus}
                onChange={e => setPaymentStatus(e.target.value as any)}
                className={`w-full px-4 py-2.5 rounded-2xl border text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 font-bold ${paymentStatusColor[paymentStatus]}`}
              >
                <option value="unpaid">Unpaid</option>
                <option value="partial">Partially Paid</option>
                <option value="paid">Fully Paid</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Sales Rep (Who Brought Sale?)</label>
              <select
                value={salesRepId}
                onChange={e => setSalesRepId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white"
              >
                <option value="">Select a sales rep...</option>
                {(members || []).map(member => (
                  <option key={member.id} value={member.id}>
                    {member.first_name || member.full_name} {member.last_name || ''} ({member.role})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Sales Remarks</label>
              <textarea
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Remarks for us to remember..."
                rows={1}
                className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white resize-none h-[42px]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Financial Notes</label>
            <textarea
              value={financialNotes}
              onChange={e => setFinancialNotes(e.target.value)}
              placeholder="Payment terms, installment details, special conditions..."
              rows={3}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 bg-white resize-none"
            />
          </div>

          {financialSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-[11px] text-emerald-700 font-semibold flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-600" />{financialSuccess}
            </div>
          )}
          {convertSuccess && (
            <div className="p-3 bg-sky-50 border border-sky-100 rounded-2xl text-[11px] text-sky-700 font-semibold flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-sky-600" />{convertSuccess}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSavingFinancials || (!canApprove && true)}
              className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
            >
              {isSavingFinancials ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Save Financial Data
            </button>
            {canApprove ? (
              <button
                type="button"
                disabled={isConverting || currentSubmission.status === 'approved'}
                onClick={handleApproveAndConvert}
                className="flex-1 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                {isConverting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                {currentSubmission.status === 'approved' ? 'Already Approved' : 'Approve & Add to Active Clients'}
              </button>
            ) : (
              <div className="flex-1 py-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 font-bold text-[10px] uppercase tracking-wider flex items-center justify-center">
                Waiting for Manager Approval
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Dynamic Sections & Answers */}
      <div className="space-y-6">
        <div className="border-b border-slate-100 pb-2">
          <h2 className="text-lg font-black text-slate-900">Submitted Requirements Specification</h2>
          <p className="text-xs text-slate-500">Read-only overview of answers and file uploads supplied by the client.</p>
        </div>

        {sections.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white border border-slate-100 rounded-3xl space-y-3">
            <FileText className="h-10 w-10 mx-auto text-slate-300" />
            <p className="text-sm font-medium">No sections or fields configured for this template.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {sections.map((section, idx) => (
              <div key={section.id} className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-start justify-between border-b border-slate-50 pb-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold text-sky-600 uppercase tracking-wider">Step {idx + 1} of {sections.length}</span>
                    <h3 className="text-base font-black text-slate-900">{section.title}</h3>
                  </div>
                  {section.description && (
                    <p className="text-xs text-slate-500 max-w-md text-right">{section.description}</p>
                  )}
                </div>

                <div className="divide-y divide-slate-50 text-sm">
                  {section.fields?.map((field) => {
                    const answer = answersMap.get(field.id)
                    const attachment = attachmentsMap.get(field.id)
                    const isSensitive = field.is_sensitive
                    const isRevealed = revealedSensitives[field.id] || false

                    let decryptedVal = ''
                    if (isSensitive && answer?.answer_encrypted) {
                      try { decryptedVal = atob(answer.answer_encrypted) }
                      catch { decryptedVal = 'Decoding Failure' }
                    }

                    return (
                      <div key={field.id} className="py-4 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900 text-xs">{field.label}</span>
                            {field.is_required && (
                              <span className="text-[9px] font-extrabold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">REQUIRED</span>
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">{field.field_type} ({field.code})</span>
                        </div>

                        <div className="md:col-span-2 space-y-2">
                          {isSensitive ? (
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1.5 rounded-xl font-mono text-xs border flex items-center gap-1.5 ${isRevealed ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                                {isRevealed ? decryptedVal : '••••••••••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRevealSensitive(field.id)}
                                className="p-2 bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                              >
                                {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          ) : field.field_type === 'file' ? (
                            attachment ? (
                              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200 max-w-md">
                                <div className="flex items-center gap-2.5 overflow-hidden">
                                  <div className="p-2 bg-sky-100 text-sky-600 rounded-xl">
                                    <Paperclip className="h-4 w-4" />
                                  </div>
                                  <div className="overflow-hidden">
                                    <span className="font-bold text-xs text-slate-900 block truncate">{attachment.file_name}</span>
                                    <span className="text-[9px] font-mono text-slate-400 block">{(attachment.file_size / 1024).toFixed(1)} KB</span>
                                  </div>
                                </div>
                                <a
                                  href={attachment.file_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-[10px] hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  Download <Download className="h-3 w-3" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-xs">No attachment uploaded.</span>
                            )
                          ) : answer?.answer_value ? (
                            <div className="p-3 bg-slate-50/50 rounded-2xl border border-slate-100 text-xs text-slate-800 font-medium">
                              {answer.answer_value}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-xs">Unanswered / blank</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
