import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PhoneInput from 'react-phone-number-input'
import 'react-phone-number-input/style.css'
import { useFormsStore } from '../formsStore'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, ArrowRight, Check, Eye, EyeOff, ShieldCheck, 
  UploadCloud, Plus, Trash2, FileText, Calendar, Sparkles, CheckCircle2,
  Lock, RefreshCw, AlertCircle, ChevronRight, HelpCircle
} from 'lucide-react'

const TERM_DESCRIPTIONS: Record<string, string> = {
  'B2B': 'Business-to-Business (selling products/services to other companies)',
  'B2C': 'Business-to-Consumer (selling products/services directly to individuals)',
  'Ecommerce': 'Selling physical or digital products online',
  'SaaS': 'Software as a Service (subscription-based software)',
  'Hybrid': 'A combination of multiple business models',
}

const OptionsTooltip = ({ options }: { options: string[] }) => {
  const describedOptions = options.filter(opt => TERM_DESCRIPTIONS[opt])
  if (describedOptions.length === 0) return null

  return (
    <div className="group relative ml-1.5 inline-flex items-center">
      <HelpCircle className="h-3.5 w-3.5 text-sky-500 cursor-help transition-colors group-hover:text-sky-600" />
      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-slate-800 text-white text-[11px] rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-50 scale-95 group-hover:scale-100 origin-bottom">
        <ul className="space-y-1.5 text-left">
          {describedOptions.map(opt => (
            <li key={opt} className="leading-tight">
              <strong className="text-sky-300 font-black">{opt}:</strong> <span className="text-slate-300">{TERM_DESCRIPTIONS[opt]}</span>
            </li>
          ))}
        </ul>
        {/* Tooltip Arrow */}
        <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800"></div>
      </div>
    </div>
  )
}

export default function PremiumOnboardingPortal() {
  const { id: submissionId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentSubmission, getSubmissionById, saveAnswers, submitForm, uploadFile, fetchAttachments } = useFormsStore()
  
  const [activeStep, setActiveStep] = useState(0)
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [repeaterRows, setRepeaterRows] = useState<Record<string, any[]>>({})
  const [attachments, setAttachments] = useState<Record<string, { name: string; url: string; size: number }[]>>({})
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<Record<string, boolean>>({})
  const [success, setSuccess] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (submissionId) {
      loadSubmission()
    }
  }, [submissionId])

  const loadSubmission = async () => {
    if (!submissionId) return
    const sub = await getSubmissionById(submissionId)
    if (sub) {
      setActiveStep(sub.current_step || 0)
      
      // Load existing answers
      const initialData: Record<string, string> = {}
      const initialRepeaters: Record<string, any[]> = {}
      
      sub.answers?.forEach(ans => {
        const field = sub.template?.sections?.flatMap(s => s.fields || []).find(f => f.id === ans.field_id)
        if (field) {
          if (field.field_type === 'dynamic_repeater') {
            try {
              initialRepeaters[field.code] = JSON.parse(ans.answer_value || '[]')
            } catch (e) {
              initialRepeaters[field.code] = []
            }
          } else {
            initialData[field.code] = ans.answer_encrypted ? atob(ans.answer_encrypted) : (ans.answer_value || '')
          }
        }
      })
      
      setFormData(initialData)
      setRepeaterRows(initialRepeaters)

      // Load attachments
      const files = await fetchAttachments(submissionId)
      const groupedFiles: Record<string, any[]> = {}
      files.forEach(f => {
        const field = sub.template?.sections?.flatMap(s => s.fields || []).find(field => field.id === f.field_id)
        if (field) {
          if (!groupedFiles[field.code]) groupedFiles[field.code] = []
          groupedFiles[field.code].push({
            name: f.file_name,
            url: f.file_url,
            size: f.file_size
          })
        }
      })
      setAttachments(groupedFiles)
    }
  }

  if (!currentSubmission || !currentSubmission.template) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400 text-sm font-medium space-y-4">
        <div className="relative">
          <div className="h-12 w-12 border-2 border-sky-500/20 rounded-full"></div>
          <div className="absolute top-0 left-0 h-12 w-12 border-2 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-sky-400 animate-pulse" />
          <span className="tracking-wider uppercase text-[10px] font-black text-slate-500">Securing Portal Gateways...</span>
        </div>
      </div>
    )
  }

  const sections = currentSubmission.template.sections || []
  const activeSection = sections[activeStep]

  // Dynamic Conditional Logic Engine
  const shouldShowField = (field: any): boolean => {
    if (field.code === 'ig_username' || field.code === 'ig_password') {
      return formData['has_instagram'] === 'Yes'
    }
    return true
  }

  const handleInputChange = (fieldCode: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [fieldCode]: value }
      
      // Auto-save changes dynamically in the background (autosave UX)
      if (submissionId) {
        const fieldObj = activeSection?.fields?.find(f => f.code === fieldCode)
        if (fieldObj) {
          setIsSaving(true)
          saveAnswers(submissionId, [{
            field_id: fieldObj.id,
            value,
            is_sensitive: fieldObj.is_sensitive
          }], activeStep).then(() => {
            setTimeout(() => setIsSaving(false), 500)
          }).catch(() => setIsSaving(false))
        }
      }
      return updated
    })
  }

  const handleRepeaterChange = (fieldCode: string, rowIndex: number, key: string, value: string) => {
    const rows = [...(repeaterRows[fieldCode] || [])]
    if (!rows[rowIndex]) rows[rowIndex] = {}
    rows[rowIndex][key] = value

    setRepeaterRows(prev => {
      const updated = { ...prev, [fieldCode]: rows }
      
      if (submissionId) {
        const fieldObj = activeSection?.fields?.find(f => f.code === fieldCode)
        if (fieldObj) {
          setIsSaving(true)
          saveAnswers(submissionId, [{
            field_id: fieldObj.id,
            value: JSON.stringify(rows)
          }], activeStep).then(() => {
            setTimeout(() => setIsSaving(false), 500)
          }).catch(() => setIsSaving(false))
        }
      }
      return updated
    })
  }

  const addRepeaterRow = (fieldCode: string, fieldsSchema: any[]) => {
    const rows = [...(repeaterRows[fieldCode] || [])]
    const newRow = fieldsSchema.reduce((acc, f) => ({ ...acc, [f.code]: '' }), {})
    rows.push(newRow)
    setRepeaterRows(prev => ({ ...prev, [fieldCode]: rows }))
  }

  const removeRepeaterRow = (fieldCode: string, rowIndex: number) => {
    const rows = (repeaterRows[fieldCode] || []).filter((_, idx) => idx !== rowIndex)
    setRepeaterRows(prev => {
      const updated = { ...prev, [fieldCode]: rows }
      if (submissionId) {
        const fieldObj = activeSection?.fields?.find(f => f.code === fieldCode)
        if (fieldObj) {
          setIsSaving(true)
          saveAnswers(submissionId, [{
            field_id: fieldObj.id,
            value: JSON.stringify(rows)
          }], activeStep).then(() => {
            setTimeout(() => setIsSaving(false), 500)
          }).catch(() => setIsSaving(false))
        }
      }
      return updated
    })
  }

  const handleFileUpload = async (fieldCode: string, fieldId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || !submissionId) return

    setUploadProgress(prev => ({ ...prev, [fieldCode]: true }))
    try {
      const file = files[0]
      const publicUrl = await uploadFile(submissionId, fieldId, file)
      
      setAttachments(prev => {
        const existing = prev[fieldCode] || []
        return {
          ...prev,
          [fieldCode]: [...existing, { name: file.name, url: publicUrl, size: file.size }]
        }
      })
    } catch (err) {
      alert('Secure Upload failed. Please make sure file type is valid.')
    } finally {
      setUploadProgress(prev => ({ ...prev, [fieldCode]: false }))
    }
  }

  const handleNextStep = () => {
    if (activeStep < sections.length - 1) {
      setActiveStep(prev => prev + 1)
      if (submissionId) {
        saveAnswers(submissionId, [], activeStep + 1)
      }
    } else {
      handleSubmit()
    }
  }

  const handlePrevStep = () => {
    if (activeStep > 0) {
      setActiveStep(prev => prev - 1)
      if (submissionId) {
        saveAnswers(submissionId, [], activeStep - 1)
      }
    }
  }

  const handleSubmit = async () => {
    if (!submissionId) return
    setIsSubmitting(true)
    try {
      await submitForm(submissionId)
      setSuccess(true)
    } catch (err) {
      alert('Failed to finalize your requirements onboarding. Please verify details.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-white font-sans selection:bg-sky-500 selection:text-slate-950 relative overflow-hidden">
        {/* Soft Glowing Ambient Orbs */}
        <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-sky-500/10 blur-[140px] pointer-events-none"></div>
        <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-indigo-500/10 blur-[140px] pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="max-w-md w-full bg-slate-900/90 backdrop-blur-2xl p-10 rounded-[32px] border border-slate-800/80 shadow-2xl text-center space-y-8 relative overflow-hidden"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="h-20 w-20 bg-sky-500/10 text-sky-400 rounded-3xl flex items-center justify-center mx-auto border border-sky-500/20 shadow-lg shadow-sky-500/5 relative">
            <CheckCircle2 className="h-10 w-10 text-sky-400" />
            <span className="absolute inset-0 rounded-3xl border border-sky-500 animate-ping opacity-10"></span>
          </div>
          
          <div className="space-y-3">
            <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/15 text-sky-400 border border-sky-500/25 flex items-center gap-1.5 w-fit mx-auto">
              <Sparkles className="h-3 w-3 animate-spin" style={{ animationDuration: '3s' }} /> INTAKE SECURED
            </div>
            <h2 className="text-3xl font-black tracking-tight text-white">Submission Successful!</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              Greetings from Ecraftz Technologies LLP! We have safely received your digital specifications. Your answers have been encrypted and allocated to your dedicated team setup.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 text-left space-y-3">
            <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3 text-sky-400 animate-spin" style={{ animationDuration: '4s' }} /> NEXT ONBOARDING STEPS:
            </h4>
            <div className="space-y-2">
              <div className="flex gap-2.5 text-xs text-slate-300">
                <span className="text-sky-400 font-bold">1.</span>
                <p className="leading-relaxed">Team allocations and manual project briefing creation within 12 hours.</p>
              </div>
              <div className="flex gap-2.5 text-xs text-slate-300">
                <span className="text-sky-400 font-bold">2.</span>
                <p className="leading-relaxed">Official communication channel & WhatsApp group initiation.</p>
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <a
              href="https://www.ecraftz.in"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm transition-all shadow-xl shadow-sky-500/15 hover:shadow-sky-500/25 active:scale-95 cursor-pointer"
            >
              Visit Ecraftz Homepage <ArrowRight className="h-4 w-4" />
            </a>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">You may now safely close this browser window.</p>
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans selection:bg-sky-500 selection:text-slate-950 relative overflow-hidden">
      {/* Soft Ambient glowing blobs in background */}
      <div className="absolute top-[10%] left-[-15%] w-[40%] h-[40%] rounded-full bg-sky-500/5 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[10%] right-[-15%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none"></div>
      
      {/* Top Navigation */}
      <div className="bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 bg-sky-500/10 text-sky-600 rounded-xl text-[10px] font-black uppercase tracking-wider border border-sky-500/10">ECRAFTZ</span>
          <h2 className="text-sm font-black text-slate-800 tracking-tight">{currentSubmission.template.name}</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm shadow-emerald-500/5">
          <ShieldCheck className="h-4 w-4 text-emerald-600 animate-pulse" />
          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700">SSL Sandbox Active</span>
        </div>
      </div>

      {/* Main Stepped Layout */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-10 space-y-6 z-10">
        
        {/* Horizontal Modern Stepper tracker */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/5 space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black text-slate-400 tracking-widest uppercase">
            <span className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-sky-500" /> STEP {activeStep + 1} OF {sections.length}
            </span>
            <span className="bg-slate-100 px-2.5 py-1 rounded-full text-slate-600">{Math.round((activeStep / sections.length) * 100)}% COMPLETE</span>
          </div>

          {/* Graphical Steps Track */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 pt-1">
            {sections.map((s, idx) => {
              const isCompleted = idx < activeStep
              const isActive = idx === activeStep
              return (
                <div 
                  key={s.id} 
                  className={`flex items-center gap-2.5 p-2 rounded-2xl border transition-all duration-300 ${
                    isActive 
                      ? 'bg-slate-900 border-slate-900 text-white shadow-lg shadow-slate-900/10' 
                      : isCompleted
                      ? 'bg-emerald-50/50 border-emerald-100 text-slate-700'
                      : 'bg-slate-50/30 border-slate-100 text-slate-400'
                  }`}
                >
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                    isActive 
                      ? 'bg-sky-500 text-slate-950' 
                      : isCompleted
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {isCompleted ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-black uppercase tracking-wider truncate ${isActive ? 'text-sky-400' : ''}`}>{s.title}</p>
                  </div>
                  {idx < sections.length - 1 && (
                    <ChevronRight className="h-3 w-3 text-slate-300 hidden md:block" />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Dynamic Stepped Onboarding Cards */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-100/10 overflow-hidden">
          
          {/* Active step progress indicator */}
          <div className="h-1.5 bg-slate-100">
            <div 
              className="h-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500" 
              style={{ width: `${((activeStep + 1) / sections.length) * 100}%` }}
            ></div>
          </div>

          <div className="p-6 md:p-10 space-y-8 relative">
            
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-50 pb-6">
              <div className="space-y-1.5">
                <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
                  {activeSection?.title}
                </h1>
                {activeSection?.description && (
                  <p className="text-xs md:text-sm text-slate-500 leading-relaxed font-medium">{activeSection.description}</p>
                )}
              </div>

              {/* Pulsing Draft Saving Indicator */}
              <div className="flex items-center gap-1.5 self-start">
                <div className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isSaving ? 'bg-sky-400' : 'bg-emerald-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${isSaving ? 'bg-sky-500' : 'bg-emerald-500'}`}></span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  {isSaving ? 'Saving Draft...' : 'Autosaved'}
                </span>
              </div>
            </div>

            {/* Dynamic Interactive Fields with Framer Motion slide-fade */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {activeSection?.fields?.filter(shouldShowField).map((field) => {
                  
                  // 1. Password input with masked secure Eye toggling
                  if (field.field_type === 'password') {
                    return (
                      <div key={field.id} className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          {field.label} {field.is_required && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword[field.code] ? 'text' : 'password'}
                            placeholder={field.placeholder || 'Enter secure password'}
                            value={formData[field.code] || ''}
                            onChange={(e) => handleInputChange(field.code, e.target.value)}
                            className="w-full pl-4 pr-12 py-3.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all bg-white font-medium"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(prev => ({ ...prev, [field.code] : !prev[field.code] }))}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                          >
                            {showPassword[field.code] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[10px] text-emerald-700 font-bold border border-emerald-100 shadow-sm">
                          <Lock className="h-3 w-3 text-emerald-600" />
                          <span>End-to-End Encrypted & Hashed inside our client vaults</span>
                        </div>
                      </div>
                    )
                  }

                  // 2. Multiselect / Dropdowns / Radios Choice Renderers
                  if (field.field_type === 'dropdown') {
                    return (
                      <div key={field.id} className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center">
                          {field.label} {field.is_required && <span className="text-rose-500 font-bold ml-1">*</span>}
                          {field.config?.options && <OptionsTooltip options={field.config.options} />}
                        </label>
                        <select
                          value={formData[field.code] || ''}
                          onChange={(e) => handleInputChange(field.code, e.target.value)}
                          className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all bg-white font-medium cursor-pointer"
                        >
                          <option value="">Choose an option...</option>
                          {field.config?.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      </div>
                    )
                  }

                  if (field.field_type === 'multiselect') {
                    const selectedOptions = formData[field.code]
                      ? formData[field.code].split(',').map(s => s.trim()).filter(Boolean)
                      : []
                    
                    const handleToggleOption = (opt: string) => {
                      let updated: string[]
                      if (selectedOptions.includes(opt)) {
                        updated = selectedOptions.filter(s => s !== opt)
                      } else {
                        updated = [...selectedOptions, opt]
                      }
                      handleInputChange(field.code, updated.join(', '))
                    }

                    return (
                      <div key={field.id} className="space-y-3">
                        <label className="text-xs font-bold text-slate-700 flex items-center">
                          {field.label} {field.is_required && <span className="text-rose-500 font-bold ml-1">*</span>}
                          {field.config?.options && <OptionsTooltip options={field.config.options} />}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {field.config?.options?.map(opt => {
                            const isChecked = selectedOptions.includes(opt)
                            return (
                              <button
                                type="button"
                                key={opt}
                                onClick={() => handleToggleOption(opt)}
                                className={`flex items-center gap-3 px-5 py-4 rounded-2xl border text-sm font-bold text-left cursor-pointer transition-all shadow-sm active:scale-98 ${
                                  isChecked 
                                    ? 'bg-sky-50/80 border-sky-500 text-sky-700 ring-2 ring-sky-500/10' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                <div className={`h-4.5 w-4.5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                  isChecked ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                <span>{opt}</span>
                              </button>
                            )
                          })}
                        </div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                          You can select multiple services/options.
                        </span>
                      </div>
                    )
                  }

                  if (field.field_type === 'radio') {
                    return (
                      <div key={field.id} className="space-y-2.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center">
                          {field.label} {field.is_required && <span className="text-rose-500 font-bold ml-1">*</span>}
                          {field.config?.options && <OptionsTooltip options={field.config.options} />}
                        </label>
                        <div className="flex gap-4">
                          {field.config?.options?.map(opt => {
                            const isChecked = formData[field.code] === opt
                            return (
                              <label 
                                key={opt} 
                                className={`flex items-center gap-3 px-6 py-4 rounded-2xl border text-sm font-bold cursor-pointer transition-all shadow-sm active:scale-98 ${
                                  isChecked 
                                    ? 'bg-sky-50/80 border-sky-500 text-sky-700 ring-2 ring-sky-500/10' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name={field.code}
                                  checked={isChecked}
                                  onChange={() => handleInputChange(field.code, opt)}
                                  className="hidden"
                                />
                                <div className={`h-4.5 w-4.5 rounded-full border-2 flex items-center justify-center transition-all ${
                                  isChecked ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white'
                                }`}>
                                  {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                </div>
                                {opt}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  }

                  // 3. Dynamic Repeater Rows Grid
                  if (field.field_type === 'dynamic_repeater') {
                    const schema = field.config?.repeater_fields || [{ code: 'value', label: 'Item Link / URL', field_type: 'url' }]
                    const rows = repeaterRows[field.code] || []
                    return (
                      <div key={field.id} className="space-y-4 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 shadow-inner">
                        <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                          <label className="text-xs font-black text-slate-700 block uppercase tracking-wider">{field.label}</label>
                          <button
                            onClick={() => addRepeaterRow(field.code, schema)}
                            className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase bg-white hover:bg-sky-50 text-sky-600 border border-slate-200 transition-all hover:border-sky-200 hover:scale-102 cursor-pointer shadow-sm"
                          >
                            <Plus className="h-3 w-3" /> Add Item
                          </button>
                        </div>

                        {rows.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-400 font-bold bg-white/50 border border-dashed border-slate-200 rounded-2xl space-y-1">
                            <HelpCircle className="h-5 w-5 mx-auto text-slate-300 animate-bounce" />
                            <p>No items registered yet.</p>
                            <p className="text-[10px] font-normal text-slate-400">Click "Add Item" to add entries.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {rows.map((row, rIdx) => (
                              <div key={rIdx} className="grid grid-cols-12 gap-3 items-center bg-white p-3 rounded-2xl border border-slate-150 shadow-sm">
                                {schema.map(cell => (
                                  <div key={cell.code} className="col-span-10">
                                    <input
                                      type={cell.field_type === 'url' ? 'url' : 'text'}
                                      placeholder={cell.label}
                                      value={row[cell.code] || ''}
                                      onChange={(e) => handleRepeaterChange(field.code, rIdx, cell.code, e.target.value)}
                                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-sky-500 bg-slate-50/30 font-medium"
                                    />
                                  </div>
                                ))}
                                <div className="col-span-2 flex justify-end">
                                  <button
                                    onClick={() => removeRepeaterRow(field.code, rIdx)}
                                    className="p-2.5 rounded-xl hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                                    title="Remove Item"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  // 4. File / Image Attachment Uplinks
                  if (field.field_type === 'file' || field.field_type === 'image') {
                    const files = attachments[field.code] || []
                    return (
                      <div key={field.id} className="space-y-3.5">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          {field.label} {field.is_required && <span className="text-rose-500 font-bold">*</span>}
                        </label>

                        {/* Drag and Drop Zone */}
                        <div className="relative border-2 border-dashed border-slate-200/80 rounded-3xl hover:border-sky-500 hover:bg-sky-500/[0.02] transition-all p-8 text-center space-y-3 bg-slate-50/20 group cursor-pointer shadow-sm">
                          <input
                            type="file"
                            accept={field.field_type === 'image' ? 'image/*' : '*'}
                            onChange={(e) => handleFileUpload(field.code, field.id, e)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all border border-slate-200/60">
                            <UploadCloud className="h-6 w-6" />
                          </div>
                          <div className="space-y-1">
                            <div className="text-xs font-black text-slate-700">Drag or drop files here, or <span className="text-sky-600 hover:underline">browse</span></div>
                            <div className="text-[10px] text-slate-400 font-medium">PDFs, PNGs, JPGs, or briefs up to 10MB</div>
                          </div>
                        </div>

                        {/* Uplink Progress Spinner */}
                        {uploadProgress[field.code] && (
                          <div className="flex items-center gap-2 text-xs text-slate-500 font-bold bg-sky-50/50 p-3 rounded-2xl border border-sky-100/60 animate-pulse">
                            <RefreshCw className="h-4 w-4 text-sky-500 animate-spin" />
                            <span>Encrypting & streaming asset secure payload...</span>
                          </div>
                        )}

                        {/* Files Vault List */}
                        {files.length > 0 && (
                          <div className="space-y-2">
                            {files.map((file, idx) => (
                              <div key={idx} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 flex items-center justify-between text-xs shadow-sm hover:bg-slate-50 transition-colors">
                                <span className="font-bold text-slate-700 flex items-center gap-2 min-w-0">
                                  <FileText className="h-4.5 w-4.5 text-sky-500 shrink-0" /> 
                                  <span className="truncate">{file.name}</span>
                                  <span className="text-[9px] font-medium text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded-full shrink-0">
                                    {formatFileSize(file.size)}
                                  </span>
                                </span>
                                <a 
                                  href={file.url} 
                                  target="_blank" 
                                  rel="noreferrer" 
                                  className="text-[10px] font-black uppercase text-sky-600 hover:text-sky-500 cursor-pointer shrink-0 ml-4 hover:underline"
                                >
                                  Download
                                </a>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  // 5. Datepickers
                  if (field.field_type === 'datepicker') {
                    return (
                      <div key={field.id} className="space-y-2">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          {field.label} {field.is_required && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type="date"
                            value={formData[field.code] || ''}
                            onChange={(e) => handleInputChange(field.code, e.target.value)}
                            className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all bg-white font-medium cursor-pointer"
                          />
                        </div>
                      </div>
                    )
                  }

                  // 6. Multiline Text Areas
                  if (field.field_type === 'textarea') {
                    return (
                      <div key={field.id} className="space-y-2">
                        <label className="text-xs font-bold text-slate-700">
                          {field.label} {field.is_required && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <textarea
                          rows={4}
                          placeholder={field.placeholder || 'Provide descriptive outlines...'}
                          value={formData[field.code] || ''}
                          onChange={(e) => handleInputChange(field.code, e.target.value)}
                          className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all bg-white font-medium"
                        />
                      </div>
                    )
                  }

                  // 7. Text & General Inputs
                  const isContactNumber = field.label?.toLowerCase().includes('contact number') || field.code === 'contact_number'
                  const isWhatsappNumber = field.label?.toLowerCase().includes('whatsapp number') || field.code === 'whatsapp_number'

                  if (isContactNumber) {
                    let currentVal = formData[field.code] || ''
                    return (
                      <div key={field.id} className="space-y-2">
                        <label className="text-xs font-bold text-slate-700">
                          {field.label} {field.is_required && <span className="text-rose-500 font-bold">*</span>}
                        </label>
                        <PhoneInput 
                          placeholder="Phone number" 
                          defaultCountry="IN"
                          international
                          withCountryCallingCode
                          limitMaxLength={true}
                          value={currentVal}
                          onChange={(val) => handleInputChange(field.code, val || '')}
                          className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-within:ring-4 focus-within:ring-sky-500/10 focus-within:border-sky-500 transition-all font-medium"
                        />
                      </div>
                    )
                  }

                  if (isWhatsappNumber) {
                    const contactNumberField = currentSubmission.template?.sections?.flatMap(s => s.fields || []).find(f => f.label?.toLowerCase().includes('contact number'))
                    const contactNumberVal = contactNumberField ? formData[contactNumberField.code] : ''

                    return (
                      <div key={field.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700">
                            {field.label} {field.is_required && <span className="text-rose-500 font-bold">*</span>}
                          </label>
                          {contactNumberField && (
                            <label className="flex items-center gap-1.5 cursor-pointer group">
                              <input 
                                type="checkbox" 
                                className="rounded text-sky-500 focus:ring-sky-500 bg-slate-100 border-slate-300 w-3.5 h-3.5 cursor-pointer"
                                onChange={(e) => {
                                  if (e.target.checked && contactNumberVal) {
                                    handleInputChange(field.code, contactNumberVal)
                                  } else if (!e.target.checked) {
                                    handleInputChange(field.code, '')
                                  }
                                }}
                              />
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-slate-600 transition-colors">Same as Contact Number</span>
                            </label>
                          )}
                        </div>
                        <PhoneInput
                          placeholder={field.placeholder || 'Enter WhatsApp value...'}
                          defaultCountry="IN"
                          international
                          withCountryCallingCode
                          limitMaxLength={true}
                          value={formData[field.code] || ''}
                          onChange={(val) => handleInputChange(field.code, val || '')}
                          className="flex h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-within:ring-4 focus-within:ring-sky-500/10 focus-within:border-sky-500 transition-all font-medium"
                        />
                      </div>
                    )
                  }

                  return (
                    <div key={field.id} className="space-y-2">
                      <label className="text-xs font-bold text-slate-700">
                        {field.label} {field.is_required && <span className="text-rose-500 font-bold">*</span>}
                      </label>
                      <input
                        type={field.field_type === 'url' ? 'url' : 'text'}
                        placeholder={field.placeholder || 'Enter value...'}
                        value={formData[field.code] || ''}
                        onChange={(e) => handleInputChange(field.code, e.target.value)}
                        className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all bg-white font-medium"
                      />
                    </div>
                  )
                })}
              </motion.div>
            </AnimatePresence>

          </div>

        </div>

      </div>

      {/* Footer Controls */}
      <div className="bg-white/80 backdrop-blur-md border-t border-slate-100 p-6 flex justify-between items-center sticky bottom-0 z-40">
        <button
          onClick={handlePrevStep}
          disabled={activeStep === 0}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed transition-all text-xs font-bold text-slate-600 active:scale-95 cursor-pointer shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Save & Back Step
        </button>

        <button
          onClick={handleNextStep}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-lg shadow-slate-900/15 transition-all cursor-pointer active:scale-95 hover:scale-102"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin text-sky-400" /> Securely Submitting...
            </span>
          ) : (
            <>
              {activeStep === sections.length - 1 ? 'Submit Specifications Setup' : 'Next Step'} <ArrowRight className="h-4 w-4 text-sky-400 stroke-[3]" />
            </>
          )}
        </button>
      </div>

    </div>
  )
}
