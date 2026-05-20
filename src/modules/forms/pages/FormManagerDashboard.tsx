import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useFormsStore } from '../formsStore'
import { useCRMStore } from '@/modules/crm/crmStore'
import { 
  FileText, Plus, Copy, Archive, CheckCircle, Clock, AlertTriangle, 
  ArrowRight, Search, BarChart3, Users, Sparkles, Settings,
  Share2, Send, X, Link2, Globe, User, ExternalLink, Check, Trash2,
  Play, Pause
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function FormManagerDashboard() {
  const { templates, submissions, isLoading, fetchTemplates, fetchSubmissions, duplicateTemplate, archiveTemplate, deleteSubmission, toggleTemplateStatus } = useFormsStore()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'templates' | 'submissions'>('submissions')
  const [templateStatusFilter, setTemplateStatusFilter] = useState<'all' | 'active'>('active')
  const navigate = useNavigate()

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false)
  const [selectedTemplateForShare, setSelectedTemplateForShare] = useState<any>(null)
  const [associationType, setAssociationType] = useState<'general' | 'lead' | 'client'>('general')
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  const { leads, clients, fetchLeads, fetchClients } = useCRMStore()
  const { createSubmission } = useFormsStore()

  useEffect(() => {
    fetchTemplates()
    fetchSubmissions()
    fetchLeads({ limit: 100 })
    fetchClients({ limit: 100 })
  }, [])

  const handleOpenShareModal = (template: any) => {
    setSelectedTemplateForShare(template)
    setAssociationType('general')
    setSelectedLeadId('')
    setSelectedClientId('')
    setGeneratedLink('')
    setIsCopied(false)
    setIsShareModalOpen(true)
  }

  const handleGenerateLink = async () => {
    if (!selectedTemplateForShare) return
    setIsGeneratingLink(true)
    try {
      const leadId = associationType === 'lead' ? selectedLeadId : undefined
      const clientId = associationType === 'client' ? selectedClientId : undefined
      
      const submission = await createSubmission(selectedTemplateForShare.id, leadId, clientId)
      if (submission) {
        const link = `${window.location.origin}/crm/onboarding/portal/${submission.id}`
        setGeneratedLink(link)
        // Auto-copy to clipboard
        await navigator.clipboard.writeText(link)
        setIsCopied(true)
        setTimeout(() => setIsCopied(false), 3000)
      }
    } catch (err) {
      console.error(err)
      alert('Failed to generate onboarding portal link. Please check organization parameters.')
    } finally {
      setIsGeneratingLink(false)
    }
  }

  const filteredTemplates = templates
    .filter(t => t.status !== 'archived')
    .filter(t => {
      if (templateStatusFilter === 'active') {
        return t.status === 'active'
      }
      return true
    })
    .filter(t => 
      t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.service_type.toLowerCase().includes(searchTerm.toLowerCase())
    )

  const filteredSubmissions = submissions.filter(s => 
    s.template?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.status.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Calculations for Enterprise-grade Analytics
  const completionRate = submissions.length > 0 
    ? Math.round(submissions.reduce((acc, curr) => acc + Number(curr.completion_rate), 0) / submissions.length)
    : 0

  const pendingReview = submissions.filter(s => s.status === 'submitted').length
  const draftSubmissions = submissions.filter(s => s.status === 'draft').length
  const activeTemplatesCount = templates.filter(t => t.status === 'active').length

  const handleDuplicate = async (id: string) => {
    if (confirm('Are you sure you want to duplicate this onboarding template?')) {
      await duplicateTemplate(id)
    }
  }

  const handleArchive = async (id: string) => {
    if (confirm('Archive this template? Clients will no longer be able to submit requests.')) {
      await archiveTemplate(id)
    }
  }

  const handleDeleteSubmission = async (id: string) => {
    if (confirm('Are you sure you want to permanently delete this onboarding submission and all of its client responses?')) {
      try {
        await deleteSubmission(id)
      } catch (err: any) {
        alert(err.message || 'Failed to delete submission')
      }
    }
  }

  const handleToggleStatus = async (id: string) => {
    try {
      await toggleTemplateStatus(id)
    } catch (err: any) {
      alert(err.message || 'Failed to toggle template status')
    }
  }

  return (
    <div className="space-y-8 p-6 max-w-7xl mx-auto">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-slate-900 text-white p-8 rounded-3xl shadow-xl shadow-slate-900/10 border border-slate-800">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> ENTERPRISE INTAKE
            </span>
          </div>
          <h1 className="text-3xl font-black tracking-tight">Onboarding & Forms Manager</h1>
          <p className="text-slate-400 text-sm max-w-xl">
            Design dynamic onboarding portal experiences, customize fields per service vertical, and streamline requirements directly into the CRM pipeline.
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => navigate('/crm/onboarding/builder')}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-sky-500/10 active:scale-95 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Create Form Template
          </button>
        </div>
      </div>

      {/* Analytics Dashboard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <span className="p-3 bg-sky-50 rounded-2xl text-sky-600">
              <FileText className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold text-slate-400">Total Forms</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{activeTemplatesCount}</h3>
            <p className="text-xs text-slate-500">Active Service Templates</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <span className="p-3 bg-indigo-50 rounded-2xl text-indigo-600">
              <BarChart3 className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold text-slate-400">Completion Rate</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{completionRate}%</h3>
            <p className="text-xs text-slate-500">Average Onboarding Progress</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <span className="p-3 bg-amber-50 rounded-2xl text-amber-600">
              <Clock className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold text-slate-400">Needs Review</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{pendingReview}</h3>
            <p className="text-xs text-slate-500">Pending Lead Conversion</p>
          </div>
        </div>

        <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-4">
          <div className="flex justify-between items-start">
            <span className="p-3 bg-emerald-50 rounded-2xl text-emerald-600">
              <Users className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold text-slate-400">Drafts Saved</span>
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{draftSubmissions}</h3>
            <p className="text-xs text-slate-500">Active Onboarding Sessions</p>
          </div>
        </div>
      </div>

      {/* Main Sections */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-2">
          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('submissions'); setSearchTerm(''); }}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'submissions' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Requirements Submissions
            </button>
            <button
              onClick={() => { setActiveTab('templates'); setSearchTerm(''); }}
              className={`px-5 py-2.5 rounded-full text-sm font-bold transition-all cursor-pointer ${
                activeTab === 'templates' 
                  ? 'bg-slate-900 text-white' 
                  : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              Templates Library
            </button>
          </div>

          {/* Controls: Filters & Search bar */}
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {activeTab === 'templates' && (
              <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50">
                <button
                  onClick={() => setTemplateStatusFilter('all')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    templateStatusFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All Templates
                </button>
                <button
                  onClick={() => setTemplateStatusFilter('active')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    templateStatusFilter === 'active'
                      ? 'bg-white text-sky-600 shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Dynamic Only
                </button>
              </div>
            )}

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all bg-white"
              />
            </div>
          </div>
        </div>

        {/* Loading / Empty States */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 text-slate-500 text-sm font-medium">
            <div className="h-6 w-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mr-3"></div>
            Synchronizing Intake Database...
          </div>
        )}

        {!isLoading && activeTab === 'submissions' && (
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            {filteredSubmissions.length === 0 ? (
              <div className="p-16 text-center text-slate-400 space-y-4">
                <FileText className="h-12 w-12 mx-auto text-slate-300" />
                <p className="text-sm font-medium">No client onboarding submissions recorded yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wider">
                      <th className="px-6 py-4">Client Name / Template</th>
                      <th className="px-6 py-4">Current Progress</th>
                      <th className="px-6 py-4">Intake Status</th>
                      <th className="px-6 py-4">Submitted At</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredSubmissions.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-900 text-sm">
                            {s.client ? s.client.name : s.lead ? `${s.lead.first_name} ${s.lead.last_name}` : 'Direct Workspace Portal'}
                          </div>
                          <div className="text-xs text-sky-600 font-semibold">{s.template?.name}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-sky-500 transition-all duration-500" 
                                style={{ width: `${s.completion_rate}%` }}
                              ></div>
                            </div>
                            <span className="text-xs font-bold text-slate-500">{Math.round(s.completion_rate)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                            s.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            s.status === 'submitted' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                            s.status === 'clarification_needed' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                            'bg-slate-50 text-slate-600 border-slate-100'
                          }`}>
                            {s.status === 'approved' && <CheckCircle className="h-3 w-3" />}
                            {s.status === 'submitted' && <Clock className="h-3 w-3" />}
                            {s.status === 'clarification_needed' && <AlertTriangle className="h-3 w-3" />}
                            {s.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {formatDistanceToNow(new Date(s.updated_at))} ago
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => navigate(`/crm/onboarding/review/${s.id}`)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-sky-600 hover:text-sky-500 transition-all cursor-pointer"
                            >
                              View Submission <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSubmission(s.id)}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete Submission"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {!isLoading && activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTemplates.length === 0 ? (
              <div className="col-span-full p-16 text-center text-slate-400 bg-white border border-slate-100 rounded-3xl space-y-4">
                <FileText className="h-12 w-12 mx-auto text-slate-300" />
                <p className="text-sm font-medium">No onboarding templates defined yet.</p>
              </div>
            ) : (
              filteredTemplates.map((t) => (
                <div key={t.id} className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                          {t.service_type}
                        </span>
                        <button
                          onClick={() => handleToggleStatus(t.id)}
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold border uppercase tracking-wider transition-all duration-200 cursor-pointer ${
                            t.status === 'active' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100/80 hover:scale-105'
                              : 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100/80 hover:scale-105'
                          }`}
                          title={`Click to switch to ${t.status === 'active' ? 'Draft' : 'Active'}`}
                        >
                          {t.status === 'active' ? 'Active' : 'Draft'}
                        </button>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900">{t.name}</h3>
                    </div>
                    <span className="text-[10px] font-black text-slate-400">V{t.version}</span>
                  </div>

                  <p className="text-slate-500 text-xs line-clamp-2 h-8">{t.description || 'No description provided.'}</p>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-4">
                    <div className="flex gap-1 items-center">
                      <button
                        onClick={() => handleDuplicate(t.id)}
                        title="Duplicate Template"
                        className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors cursor-pointer"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleToggleStatus(t.id)}
                        title={t.status === 'active' ? "Switch to Draft" : "Switch to Active"}
                        className={`p-2 rounded-xl transition-colors cursor-pointer ${
                          t.status === 'active' 
                            ? 'text-amber-500 hover:bg-amber-50 hover:text-amber-600'
                            : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600'
                        }`}
                      >
                        {t.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => handleArchive(t.id)}
                        title="Archive Template"
                        className="p-2 rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <Link
                        to={`/crm/onboarding/builder?id=${t.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
                      >
                        Edit <Settings className="h-3 w-3" />
                      </Link>
                      <button
                        onClick={() => handleOpenShareModal(t)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-sm transition-colors cursor-pointer"
                      >
                        Send Link <Send className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Premium Dynamic Modal overlay */}
      {isShareModalOpen && selectedTemplateForShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden transition-all duration-300 transform scale-100">
            {/* Header */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl">
                  <Send className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Generate Onboarding Portal</h3>
                  <p className="text-xs text-slate-500 font-medium">Create and share a secure, dynamic client intake path.</p>
                </div>
              </div>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 space-y-6">
              {/* Template Info Card */}
              <div className="p-4 rounded-2xl bg-sky-50/40 border border-sky-100/50 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                    {selectedTemplateForShare.service_type}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm mt-1.5">{selectedTemplateForShare.name}</h4>
                </div>
                <span className="text-xs font-bold text-slate-400">V{selectedTemplateForShare.version}</span>
              </div>

              {!generatedLink ? (
                <>
                  {/* Select Association Type */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Associate Portal With:</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setAssociationType('general')}
                        className={`py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                          associationType === 'general'
                            ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Globe className="h-4 w-4" />
                        <span>General / Public</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssociationType('lead')}
                        className={`py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                          associationType === 'lead'
                            ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <Users className="h-4 w-4" />
                        <span>CRM Lead</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssociationType('client')}
                        className={`py-3 px-2 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                          associationType === 'client'
                            ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <User className="h-4 w-4" />
                        <span>Active Client</span>
                      </button>
                    </div>
                  </div>

                  {/* Dropdowns based on selection */}
                  {associationType === 'lead' && (
                    <div className="space-y-2 animate-slide-down">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Select Target CRM Lead:</label>
                      <select
                        value={selectedLeadId}
                        onChange={(e) => setSelectedLeadId(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                      >
                        <option value="">Choose a lead...</option>
                        {leads.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.first_name} {l.last_name} ({l.company || 'Individual'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {associationType === 'client' && (
                    <div className="space-y-2 animate-slide-down">
                      <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Select Target Active Client:</label>
                      <select
                        value={selectedClientId}
                        onChange={(e) => setSelectedClientId(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
                      >
                        <option value="">Choose a client...</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.company || 'Individual'})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Generate Button */}
                  <div className="pt-2">
                    <button
                      onClick={handleGenerateLink}
                      disabled={isGeneratingLink || (associationType === 'lead' && !selectedLeadId) || (associationType === 'client' && !selectedClientId)}
                      className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-sky-500 text-slate-950 font-bold text-sm shadow-xl shadow-sky-500/10 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
                    >
                      {isGeneratingLink ? (
                        <>
                          <div className="h-4 w-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                          Initializing Secure Portal...
                        </>
                      ) : (
                        <>
                          Generate & Copy Intake Link <Link2 className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                /* Link Generated State */
                <div className="space-y-6 animate-fade-in">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center space-y-2">
                    <div className="h-10 w-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                      <Check className="h-5 w-5" />
                    </div>
                    <h5 className="font-bold text-emerald-800 text-sm">Secure Portal Link Generated!</h5>
                    <p className="text-[11px] text-emerald-600 font-medium">Successfully copied to your clipboard. Send this to the client to begin intake onboarding.</p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Intake Portal URL:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={generatedLink}
                        className="flex-1 px-4 py-3 rounded-2xl border border-slate-200 text-xs font-mono bg-slate-50 focus:outline-none"
                      />
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(generatedLink)
                          setIsCopied(true)
                          setTimeout(() => setIsCopied(false), 2000)
                        }}
                        className={`px-4 rounded-2xl font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                          isCopied 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {isCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex gap-3">
                    <a
                      href={generatedLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      Preview Portal <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => setGeneratedLink('')}
                      className="flex-1 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      Generate Another Portal
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
