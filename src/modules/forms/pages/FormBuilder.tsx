import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useFormsStore } from '../formsStore'
import { 
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Save, Sparkles, AlertCircle, FileText
} from 'lucide-react'
import type { FormTemplate, FormSection, FormField } from '../types'

const SERVICES = [
  'Web Development',
  'Digital Marketing',
  'SEO Services',
  'Content Creation',
  'Branding & Design',
  'Social Media Management',
  'Ecommerce Development',
  'Mobile App Development',
  'Custom Software Development'
]

export default function FormBuilder() {
  const [searchParams] = useSearchParams()
  const templateId = searchParams.get('id')
  const navigate = useNavigate()
  const { templates, saveTemplate, fetchTemplates } = useFormsStore()

  const [name, setName] = useState('')
  const [serviceType, setServiceType] = useState('Web Development')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<'active' | 'draft'>('draft')

  const [sections, setSections] = useState<(Partial<FormSection> & { fields: Partial<FormField>[] })[]>([
    { title: 'Company Information', description: 'Base coordinates of the organization', sort_order: 0, fields: [] }
  ])

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    if (templateId) {
      const template = templates.find(t => t.id === templateId)
      if (template) {
        setName(template.name)
        setServiceType(template.service_type)
        setDescription(template.description || '')
        setStatus(template.status as 'active' | 'draft')
        
        const mappedSections = (template.sections || []).map(s => ({
          id: s.id,
          title: s.title,
          description: s.description,
          sort_order: s.sort_order,
          fields: (s.fields || []).map(f => ({
            id: f.id,
            code: f.code,
            label: f.label,
            placeholder: f.placeholder,
            field_type: f.field_type,
            is_required: f.is_required,
            is_sensitive: f.is_sensitive,
            sort_order: f.sort_order,
            config: f.config
          }))
        }))
        setSections(mappedSections)
      }
    }
  }, [templateId, templates])

  const handleAddSection = () => {
    setSections([
      ...sections,
      {
        title: `New Section ${sections.length + 1}`,
        description: '',
        sort_order: sections.length,
        fields: []
      }
    ])
  }

  const handleRemoveSection = (index: number) => {
    setSections(sections.filter((_, i) => i !== index))
  }

  const handleAddField = (sectionIndex: number) => {
    const section = sections[sectionIndex]
    const updatedFields = [
      ...section.fields,
      {
        code: `field_${Date.now().toString().slice(-6)}`,
        label: 'New Question Label',
        placeholder: 'Enter answer here...',
        field_type: 'text' as const,
        is_required: false,
        is_sensitive: false,
        sort_order: section.fields.length,
        config: {}
      }
    ]

    setSections(
      sections.map((s, idx) => (idx === sectionIndex ? { ...s, fields: updatedFields } : s))
    )
  }

  const handleRemoveField = (sectionIndex: number, fieldIndex: number) => {
    const section = sections[sectionIndex]
    const updatedFields = section.fields.filter((_, fIdx) => fIdx !== fieldIndex)
    setSections(
      sections.map((s, idx) => (idx === sectionIndex ? { ...s, fields: updatedFields } : s))
    )
  }

  const handleFieldChange = (sectionIndex: number, fieldIndex: number, key: keyof FormField, value: any) => {
    const section = sections[sectionIndex]
    const updatedFields = section.fields.map((f, fIdx) => 
      fIdx === fieldIndex ? { ...f, [key]: value } : f
    )
    setSections(
      sections.map((s, idx) => (idx === sectionIndex ? { ...s, fields: updatedFields } : s))
    )
  }

  // Pre-seed premium presets dynamically
  const loadPreset = (presetType: 'marketing' | 'web_dev' | 'content') => {
    if (presetType === 'marketing') {
      setName('Digital Marketing Premium Intake v1')
      setServiceType('Digital Marketing')
      setDescription('Comprehensive intake request encompassing Company context, Social channels, and Credential files.')
      setSections([
        {
          title: 'COMPANY INFORMATION',
          description: 'Official corporate indicators',
          sort_order: 0,
          fields: [
            { code: 'company_name', label: 'Company Name', placeholder: 'e.g. ACME Corp', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 0, config: {} },
            { code: 'contact_name', label: 'Contact Person Name', placeholder: 'Jane Doe', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 1, config: {} },
            { code: 'contact_email', label: 'Official Email', placeholder: 'jane@acmecorp.com', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 2, config: {} },
            { code: 'services_needed', label: 'Interested Services (Select all that apply)', placeholder: '', field_type: 'multiselect', is_required: true, is_sensitive: false, sort_order: 3, config: { options: ['Web Development', 'Digital Marketing', 'Content Creation', 'SEO Services', 'Branding & Design', 'Social Media Management'] } },
            { code: 'contact_phone', label: 'Contact Number', placeholder: '+1 (555) 0199', field_type: 'text', is_required: false, is_sensitive: false, sort_order: 4, config: {} },
            { code: 'whatsapp_phone', label: 'WhatsApp Number', placeholder: '+1 (555) 0199', field_type: 'text', is_required: false, is_sensitive: false, sort_order: 5, config: {} },
            { code: 'company_address', label: 'Company Address', placeholder: '123 Main St', field_type: 'textarea', is_required: false, is_sensitive: false, sort_order: 6, config: {} },
            { code: 'website_address', label: 'Website Address', placeholder: 'https://acmecorp.com', field_type: 'url', is_required: false, is_sensitive: false, sort_order: 7, config: {} },
            { code: 'company_logo', label: 'Company Logo Upload', placeholder: '', field_type: 'image', is_required: false, is_sensitive: false, sort_order: 8, config: {} }
          ]
        },
        {
          title: 'BUSINESS INFORMATION',
          description: 'Market space positioning and dynamic targets',
          sort_order: 1,
          fields: [
            { code: 'biz_description', label: 'Company Products/Services', placeholder: 'What do you sell?', field_type: 'textarea', is_required: true, is_sensitive: false, sort_order: 0, config: {} },
            { code: 'area_operation', label: 'Area of Operation', placeholder: 'Regional, National, Global', field_type: 'text', is_required: false, is_sensitive: false, sort_order: 1, config: {} },
            { code: 'biz_highlights', label: 'Key Highlights', placeholder: 'Dynamic USPs', field_type: 'textarea', is_required: false, is_sensitive: false, sort_order: 2, config: {} },
            { code: 'biz_type', label: 'Business Type', placeholder: '', field_type: 'dropdown', is_required: true, is_sensitive: false, sort_order: 3, config: { options: ['B2B', 'B2C', 'Ecommerce', 'SaaS', 'Hybrid'] } },
            { code: 'target_locations', label: 'Target Locations', placeholder: 'United States, India, Europe', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 4, config: {} },
            { code: 'customer_age', label: 'Customer Age Group', placeholder: '18-24, 25-34, 35-50', field_type: 'text', is_required: false, is_sensitive: false, sort_order: 5, config: {} }
          ]
        },
        {
          title: 'SOCIAL MEDIA INFORMATION',
          description: 'Official accounts credentials & links (secured via encryption & masked in UI)',
          sort_order: 2,
          fields: [
            { code: 'has_instagram', label: 'Do you have an Instagram account?', placeholder: '', field_type: 'radio', is_required: true, is_sensitive: false, sort_order: 0, config: { options: ['Yes', 'No'] } },
            { code: 'ig_username', label: 'Instagram Username', placeholder: 'acme_agency', field_type: 'text', is_required: false, is_sensitive: false, sort_order: 1, config: {} },
            { code: 'ig_password', label: 'Instagram Password', placeholder: 'password', field_type: 'password', is_required: false, is_sensitive: true, sort_order: 2, config: {} },
            { code: 'li_username', label: 'LinkedIn Username', placeholder: 'acme_corp', field_type: 'text', is_required: false, is_sensitive: false, sort_order: 3, config: {} },
            { code: 'li_password', label: 'LinkedIn Password', placeholder: 'password', field_type: 'password', is_required: false, is_sensitive: true, sort_order: 4, config: {} },
            { code: 'additional_remarks', label: 'Additional Remarks & Special Requirements', placeholder: 'List any other custom requirements, business parameters, or needs not covered above...', field_type: 'textarea', is_required: false, is_sensitive: false, sort_order: 5, config: {} }
          ]
        }
      ])
    } else if (presetType === 'web_dev') {
      setName('Web Development Dynamic Specification v1')
      setServiceType('Web Development')
      setDescription('Structured system layout detailing server, database hosting, expected pages, and design style.')
      setSections([
        {
          title: 'Company Information',
          description: 'Base details for branding',
          sort_order: 0,
          fields: [
            { code: 'company_name', label: 'Company Name', placeholder: 'e.g. ACME Corp', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 0, config: {} },
            { code: 'contact_name', label: 'Contact Person Name', placeholder: 'Jane Doe', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 1, config: {} },
            { code: 'contact_email', label: 'Official Email', placeholder: 'jane@acmecorp.com', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 2, config: {} },
            { code: 'services_needed', label: 'Interested Services (Select all that apply)', placeholder: '', field_type: 'multiselect', is_required: true, is_sensitive: false, sort_order: 3, config: { options: ['Web Development', 'Digital Marketing', 'Content Creation', 'SEO Services', 'Branding & Design', 'Social Media Management'] } }
          ]
        },
        {
          title: 'Specification Detail',
          description: 'Hosting setups, preferred pages, design specifications',
          sort_order: 1,
          fields: [
            { code: 'domain_status', label: 'Domain/Hosting Status', placeholder: '', field_type: 'dropdown', is_required: true, is_sensitive: false, sort_order: 0, config: { options: ['Have Domain & Hosting', 'Need Both Domain & Hosting', 'Have Domain, Need Hosting'] } },
            { code: 'existing_site', label: 'Existing Website URL', placeholder: 'https://mysite.com', field_type: 'url', is_required: false, is_sensitive: false, sort_order: 1, config: {} },
            { code: 'required_pages', label: 'Required Pages', placeholder: 'Home, About, Services, Contact, Blog', field_type: 'textarea', is_required: true, is_sensitive: false, sort_order: 2, config: {} },
            { code: 'ecommerce_needed', label: 'Ecommerce Needed?', placeholder: '', field_type: 'radio', is_required: true, is_sensitive: false, sort_order: 3, config: { options: ['Yes', 'No'] } },
            { code: 'payment_gateway', label: 'Preferred Payment Gateway?', placeholder: 'Stripe, PayPal, Razorpay', field_type: 'text', is_required: false, is_sensitive: false, sort_order: 4, config: {} },
            { code: 'admin_panel', label: 'Admin Panel Needed?', placeholder: '', field_type: 'radio', is_required: true, is_sensitive: false, sort_order: 5, config: { options: ['Yes', 'No'] } },
            { code: 'booking_system', label: 'Booking System?', placeholder: '', field_type: 'radio', is_required: true, is_sensitive: false, sort_order: 6, config: { options: ['Yes', 'No'] } },
            { code: 'design_style', label: 'Preferred Design Style', placeholder: 'Minimalist, Bold, Corporate, Playful', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 7, config: {} },
            { code: 'additional_remarks', label: 'Additional Remarks & Custom System Features', placeholder: 'List any other dynamic functionalities, API integrations, or client needs not listed above...', field_type: 'textarea', is_required: false, is_sensitive: false, sort_order: 8, config: {} }
          ]
        }
      ])
    } else {
      setName('Content Creation Requirements Questionnaire')
      setServiceType('Content Creation')
      setDescription('Creative tone, assets availability, and publishing targets.')
      setSections([
        {
          title: 'Brand Tone & Content Goal',
          description: 'Establish branding aesthetics',
          sort_order: 0,
          fields: [
            { code: 'services_needed', label: 'Interested Services (Select all that apply)', placeholder: '', field_type: 'multiselect', is_required: true, is_sensitive: false, sort_order: 0, config: { options: ['Web Development', 'Digital Marketing', 'Content Creation', 'SEO Services', 'Branding & Design', 'Social Media Management'] } },
            { code: 'content_types', label: 'Content Types', placeholder: 'Reels, Posts, Newsletters, Blog Articles', field_type: 'multiselect', is_required: true, is_sensitive: false, sort_order: 1, config: { options: ['Reels', 'Static Images', 'Carousels', 'Blogs', 'Email Newsletters'] } },
            { code: 'posting_frequency', label: 'Posting Frequency', placeholder: '3x weekly, Daily, Monthly', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 2, config: {} },
            { code: 'brand_tone', label: 'Brand Tone', placeholder: 'Professional, Witty, Informative, Aesthetic', field_type: 'text', is_required: true, is_sensitive: false, sort_order: 3, config: {} },
            { code: 'brand_assets', label: 'Existing Brand Assets', placeholder: 'Links to Dropbox/GDrive brandkits', field_type: 'textarea', is_required: false, is_sensitive: false, sort_order: 4, config: {} },
            { code: 'additional_remarks', label: 'Additional Remarks & Content Specifics', placeholder: 'Outline any other custom content targets, creative wishes, or expectations not listed here...', field_type: 'textarea', is_required: false, is_sensitive: false, sort_order: 5, config: {} }
          ]
        }
      ])
    }
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Please provide a form template name.')
      return
    }

    try {
      const templatePayload: Partial<FormTemplate> = {
        id: templateId || undefined,
        name,
        service_type: serviceType,
        description,
        status
      }

      await saveTemplate(templatePayload, sections)
      alert('Onboarding Template Saved Successfully!')
      navigate('/crm/onboarding')
    } catch (err) {
      console.error(err)
      alert('Failed to save template. Please verify input data.')
    }
  }

  return (
    <div className="space-y-8 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/crm/onboarding')}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900">Dynamic Onboarding Form Builder</h1>
            <p className="text-xs text-slate-500">Design zero-code, fully reusable service questionnaires.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
        >
          <Save className="h-3.5 w-3.5" /> Save Template Layout
        </button>
      </div>

      {/* Preset Seeder */}
      <div className="p-5 rounded-3xl bg-sky-50/50 border border-sky-100 space-y-3">
        <h3 className="text-xs font-black text-sky-800 flex items-center gap-1.5 uppercase">
          <Sparkles className="h-3.5 w-3.5" /> Instantly Load Predefined Core Outlines
        </h3>
        <p className="text-xs text-sky-600/80">Select one of our premium onboarding presets to populate all questions, fields, and structures dynamically instantly:</p>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => loadPreset('marketing')}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors cursor-pointer"
          >
            🎯 Digital Marketing Preset
          </button>
          <button
            onClick={() => loadPreset('web_dev')}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors cursor-pointer"
          >
            💻 Web Development Preset
          </button>
          <button
            onClick={() => loadPreset('content')}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-white hover:bg-sky-100 text-sky-700 border border-sky-200 transition-colors cursor-pointer"
          >
            ✍️ Content Creation Preset
          </button>
        </div>
      </div>

      {/* Template Details Card */}
      <div className="p-6 rounded-3xl bg-white border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-sm font-bold text-slate-800 border-b border-slate-50 pb-2">1. Template General Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-1.5 col-span-2">
            <label className="text-xs font-bold text-slate-500">Template Name</label>
            <input
              type="text"
              placeholder="e.g. Premium Branding Requirements Form"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">Service Category</label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
            >
              {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500">Intake Availability State</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'draft')}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
            >
              <option value="draft">Draft / Internal Testing</option>
              <option value="active">Active Onboarding Portal Portal Link</option>
            </select>
          </div>

          <div className="space-y-1.5 col-span-2">
            <label className="text-xs font-bold text-slate-500">Onboarding Portal Description</label>
            <textarea
              rows={2}
              placeholder="Brief directions displayed to clients as they begin requirements submission..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 bg-white"
            />
          </div>
        </div>
      </div>

      {/* Dynamic Sections and Fields */}
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">2. Interactive Form Steps & Questions</h2>
          <button
            onClick={handleAddSection}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" /> Add Section
          </button>
        </div>

        {sections.map((section, sIdx) => (
          <div key={sIdx} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-6 relative">
            
            {/* Section Header Controls */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="space-y-3 w-full max-w-xl">
                <input
                  type="text"
                  placeholder="Section Title (e.g. DOMAIN & HOSTING)"
                  value={section.title}
                  onChange={(e) => {
                    setSections(sections.map((s, idx) => idx === sIdx ? { ...s, title: e.target.value } : s))
                  }}
                  className="w-full text-base font-black text-slate-900 border-b border-transparent hover:border-slate-200 focus:border-sky-500 focus:outline-none py-1 bg-transparent"
                />
                <input
                  type="text"
                  placeholder="Section subtext or guiding tip..."
                  value={section.description || ''}
                  onChange={(e) => {
                    setSections(sections.map((s, idx) => idx === sIdx ? { ...s, description: e.target.value } : s))
                  }}
                  className="w-full text-xs text-slate-500 border-b border-transparent hover:border-slate-200 focus:border-sky-500 focus:outline-none py-0.5 bg-transparent"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRemoveSection(sIdx)}
                  className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Fields List */}
            <div className="space-y-6">
              {section.fields.map((field, fIdx) => (
                <div key={fIdx} className="p-5 rounded-2xl bg-slate-50/50 border border-slate-100 grid grid-cols-1 md:grid-cols-12 gap-4 items-end relative hover:bg-slate-50 transition-colors">
                  
                  {/* Field Code Reference */}
                  <div className="space-y-1.5 md:col-span-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Field Code (Unique ID)</label>
                    <input
                      type="text"
                      value={field.code}
                      onChange={(e) => handleFieldChange(sIdx, fIdx, 'code', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white font-mono"
                    />
                  </div>

                  {/* Field Question Label */}
                  <div className="space-y-1.5 md:col-span-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Question Label</label>
                    <input
                      type="text"
                      value={field.label}
                      onChange={(e) => handleFieldChange(sIdx, fIdx, 'label', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white font-medium"
                    />
                  </div>

                  {/* Field Type Selector */}
                  <div className="space-y-1.5 md:col-span-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Input Element Type</label>
                    <select
                      value={field.field_type}
                      onChange={(e) => handleFieldChange(sIdx, fIdx, 'field_type', e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none bg-white"
                    >
                      <option value="text">Text Input</option>
                      <option value="textarea">Text Area</option>
                      <option value="dropdown">Dropdown Options</option>
                      <option value="radio">Radio Toggles</option>
                      <option value="multiselect">Multi-Select Choice</option>
                      <option value="datepicker">Date Picker</option>
                      <option value="file">File Upload Vault</option>
                      <option value="image">Image Attachment</option>
                      <option value="url">URL Validation</option>
                      <option value="password">Masked Password Input</option>
                      <option value="dynamic_repeater">Dynamic Repeater Grid</option>
                    </select>
                  </div>

                  {/* Validation Toggles */}
                  <div className="flex flex-col gap-2 md:col-span-2 pb-1.5">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={field.is_required}
                        onChange={(e) => handleFieldChange(sIdx, fIdx, 'is_required', e.target.checked)}
                        className="rounded border-slate-300 text-sky-500 focus:ring-sky-500 h-4.5 w-4.5"
                      />
                      Required
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer" title="Masks input value and encrypts token at rest">
                      <input
                        type="checkbox"
                        checked={field.is_sensitive}
                        onChange={(e) => handleFieldChange(sIdx, fIdx, 'is_sensitive', e.target.checked)}
                        className="rounded border-slate-300 text-sky-500 focus:ring-sky-500 h-4.5 w-4.5"
                      />
                      Sensitive Key
                    </label>
                  </div>

                  {/* Option values for choices */}
                  {['dropdown', 'radio', 'multiselect'].includes(field.field_type || '') && (
                    <div className="md:col-span-10 space-y-1 bg-white p-3 rounded-xl border border-slate-100">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Choices Configuration (separated by commas)</label>
                      <input
                        type="text"
                        placeholder="e.g. Yes, No, Maybe or B2B, B2C, Hybrid"
                        value={field.config?.options?.join(', ') || ''}
                        onChange={(e) => {
                          const options = e.target.value.split(',').map(o => o.trim()).filter(Boolean)
                          handleFieldChange(sIdx, fIdx, 'config', { ...field.config, options })
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Actions Column */}
                  <div className="md:col-span-2 flex justify-end">
                    <button
                      onClick={() => handleRemoveField(sIdx, fIdx)}
                      className="p-2.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors cursor-pointer"
                      title="Delete Question"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                </div>
              ))}
            </div>

            <button
              onClick={() => handleAddField(sIdx)}
              className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-2xl hover:border-sky-500 hover:bg-sky-50/20 text-xs font-bold text-slate-500 hover:text-sky-600 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Add Dynamic Question Input
            </button>

          </div>
        ))}
      </div>
    </div>
  )
}
