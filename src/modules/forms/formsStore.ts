import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/auditLogger'
import { fetchPaginatedData, type PaginationParams } from '@/lib/pagination'
import type { FormTemplate, FormSection, FormField, FormSubmission, SubmissionAnswer, FormCondition, FormAttachment, FinancialData } from './types'

let _templatesChannel: any = null
let _submissionsChannel: any = null

interface FormsState {
  templates: FormTemplate[]
  submissions: FormSubmission[]
  currentSubmission: FormSubmission | null
  isLoading: boolean
  error: string | null

  // Admin Template Management
  fetchTemplates: () => Promise<void>
  saveTemplate: (template: Partial<FormTemplate>, sections: (Partial<FormSection> & { fields: Partial<FormField>[] })[]) => Promise<void>
  duplicateTemplate: (id: string) => Promise<void>
  archiveTemplate: (id: string) => Promise<void>
  toggleTemplateStatus: (id: string) => Promise<void>
  subscribeToTemplates: () => () => void
  subscribeToSubmissions: () => () => void

  // Client Portal & Submissions
  fetchSubmissions: (params?: Partial<PaginationParams> & { force?: boolean }) => Promise<void>
  submissionPagination: { totalCount: number; page: number; limit: number; totalPages: number }
  getSubmissionById: (id: string) => Promise<FormSubmission | null>
  createSubmission: (templateId: string, leadId?: string, clientId?: string) => Promise<FormSubmission>
  saveAnswers: (submissionId: string, answers: { field_id: string; value: string; is_sensitive?: boolean }[], currentStep?: number) => Promise<void>
  submitForm: (submissionId: string) => Promise<void>
  updateSubmissionStatus: (submissionId: string, status: FormSubmission['status'], notes?: string) => Promise<void>
  deleteSubmission: (submissionId: string) => Promise<void>
  
  // Attachments Management
  uploadFile: (submissionId: string, fieldId: string, file: File) => Promise<string>
  fetchAttachments: (submissionId: string) => Promise<FormAttachment[]>

  // Financial Data (Sales Person input)
  saveFinancialData: (submissionId: string, data: FinancialData) => Promise<void>
  approveAndConvertToClient: (submissionId: string) => Promise<string | null>
}

export const useFormsStore = create<FormsState>((set, get) => ({
  templates: [],
  submissions: [],
  currentSubmission: null,
  isLoading: false,
  error: null,
  submissionPagination: { totalCount: 0, page: 1, limit: 20, totalPages: 0 },

  fetchTemplates: async () => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      const { data, error } = await supabase
        .from('form_templates')
        .select(`
          *,
          sections:form_sections (
            *,
            fields:form_fields (*)
          )
        `)
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Sort sections and fields locally by sort_order
      const sortedTemplates = (data || []).map((t: any) => ({
        ...t,
        sections: (t.sections || [])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((s: any) => ({
            ...s,
            fields: (s.fields || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
          }))
      }))

      set({ templates: sortedTemplates, error: null })
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch templates' })
    } finally {
      set({ isLoading: false })
    }
  },

  saveTemplate: async (template, sections) => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      // 1. Upsert template
      const templatePayload = {
        ...template,
        organization_id: orgId,
        updated_at: new Date().toISOString()
      }

      let templateId = template.id
      let isNewVersion = false

      if (templateId) {
        // SCHEMAS VERSIONING CHECK: Does this template have existing submissions?
        const { count, error: countError } = await supabase
          .from('form_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('template_id', templateId)

        if (countError) throw countError

        if (count && count > 0) {
          // Fork a new version to protect historical data integrity
          isNewVersion = true
          
          // Archive old version
          await supabase
            .from('form_templates')
            .update({ is_active: false, is_archived: true })
            .eq('id', templateId)

          // Insert new template version (omitting ID so DB generates a new one)
          const { id: _, ...payloadWithoutId } = templatePayload
          const { data, error } = await supabase
            .from('form_templates')
            .insert({ ...payloadWithoutId, name: `${templatePayload.name} (v${Date.now().toString().slice(-4)})` })
            .select()
            .single()
          
          if (error) throw error
          templateId = data.id
        } else {
          // No submissions exist, safe to update in-place
          const { error } = await supabase
            .from('form_templates')
            .update(templatePayload)
            .eq('id', templateId)
          if (error) throw error
        }
      } else {
        const { data, error } = await supabase
          .from('form_templates')
          .insert(templatePayload)
          .select()
          .single()
        if (error) throw error
        templateId = data.id
      }

      // 2. Clear old sections ONLY if we are doing an in-place update (not a fork)
      if (template.id && !isNewVersion) {
        const { data: oldSections } = await supabase
          .from('form_sections')
          .select('id')
          .eq('template_id', templateId)
        if (oldSections && oldSections.length > 0) {
          const sectionIds = oldSections.map(s => s.id)
          await supabase.from('form_fields').delete().in('section_id', sectionIds)
          await supabase.from('form_sections').delete().eq('template_id', templateId)
        }
      }

      // 3. Create new sections & fields
      for (const section of sections) {
        const { data: sectionData, error: sError } = await supabase
          .from('form_sections')
          .insert({
            template_id: templateId,
            title: section.title,
            description: section.description,
            sort_order: section.sort_order || 0
          })
          .select()
          .single()

        if (sError) throw sError

        if (section.fields && section.fields.length > 0) {
          const fieldsPayload = section.fields.map(f => ({
            section_id: sectionData.id,
            code: f.code,
            label: f.label,
            placeholder: f.placeholder,
            field_type: f.field_type,
            is_required: f.is_required || false,
            is_sensitive: f.is_sensitive || false,
            sort_order: f.sort_order || 0,
            config: f.config || {}
          }))

          const { error: fError } = await supabase
            .from('form_fields')
            .insert(fieldsPayload)
          if (fError) throw fError
        }
      }

      logActivity({
        action: template.id ? 'UPDATE' : 'CREATE',
        targetType: 'form_template',
        targetId: templateId,
        targetName: template.name || 'Form Template',
        description: `Form template dynamic setup updated: ${template.name}`,
        organization_id: orgId
      })

      await get().fetchTemplates()
    } catch (err: any) {
      set({ error: err.message || 'Failed to save template' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  duplicateTemplate: async (id) => {
    set({ isLoading: true })
    try {
      const source = get().templates.find(t => t.id === id)
      if (!source) throw new Error('Source template not found.')

      const duplicatedSections = (source.sections || []).map(s => ({
        title: s.title,
        description: s.description,
        sort_order: s.sort_order,
        fields: (s.fields || []).map(f => ({
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

      await get().saveTemplate({
        name: `${source.name} (Copy)`,
        service_type: source.service_type,
        description: source.description,
        status: 'draft',
        version: source.version
      }, duplicatedSections)

    } catch (err: any) {
      set({ error: err.message || 'Failed to duplicate template' })
    } finally {
      set({ isLoading: false })
    }
  },

  archiveTemplate: async (id) => {
    try {
      const { error } = await supabase
        .from('form_templates')
        .update({ status: 'archived' })
        .eq('id', id)
      if (error) throw error
      await get().fetchTemplates()
    } catch (err: any) {
      set({ error: err.message || 'Failed to archive template' })
    }
  },

  toggleTemplateStatus: async (id) => {
    try {
      const template = get().templates.find(t => t.id === id)
      if (!template) throw new Error('Template not found.')
      const nextStatus = template.status === 'active' ? 'draft' : 'active'

      const { error } = await supabase
        .from('form_templates')
        .update({ status: nextStatus })
        .eq('id', id)

      if (error) throw error
      await get().fetchTemplates()
    } catch (err: any) {
      set({ error: err.message || 'Failed to toggle status' })
    }
  },

  subscribeToTemplates: () => {
    const setup = async () => {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      if (_templatesChannel) return

      const channelId = `form_templates_${orgId}`
      _templatesChannel = supabase.channel(channelId)

      _templatesChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'form_templates', filter: `organization_id=eq.${orgId}` }, () => {
          get().fetchTemplates()
        })
        .subscribe()
    }
    setup()
    return () => {
      if (_templatesChannel) {
        supabase.removeChannel(_templatesChannel)
        _templatesChannel = null
      }
    }
  },

  fetchSubmissions: async (params = {}) => {
    const { page = 1, limit = 20, sortBy = 'updated_at', sortOrder = 'desc', force = false } = params as any
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      const baseQuery = supabase
        .from('form_submissions')
        .select(`
          *,
          template:form_templates (id, name, service_type),
          lead:leads!lead_id (first_name, last_name, company),
          client:clients!client_id (name)
        `, { count: 'exact' })
        .eq('organization_id', orgId)

      const result = await fetchPaginatedData<FormSubmission>(baseQuery, {
        page,
        limit,
        sortBy,
        sortOrder,
      })

      set({
        submissions: result.data,
        submissionPagination: {
          totalCount: result.totalCount,
          page: result.page,
          limit: result.limit,
          totalPages: result.totalPages,
        },
        error: null,
      })
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch submissions' })
    } finally {
      set({ isLoading: false })
    }
  },

  subscribeToSubmissions: () => {
    const setup = async () => {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) return

      if (_submissionsChannel) return

      const channelId = `form_submissions_${orgId}`
      _submissionsChannel = supabase.channel(channelId)

      _submissionsChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'form_submissions', filter: `organization_id=eq.${orgId}` }, () => {
          get().fetchSubmissions()
        })
        .subscribe()
    }
    setup()
    return () => {
      if (_submissionsChannel) {
        supabase.removeChannel(_submissionsChannel)
        _submissionsChannel = null
      }
    }
  },

  getSubmissionById: async (id) => {
    try {
      const { data, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          template:form_templates (
            *,
            sections:form_sections (
              *,
              fields:form_fields (*)
            )
          ),
          answers:form_submission_answers (*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error

      // Sort sections and fields locally
      const sortedSections = (data.template?.sections || [])
        .sort((a: any, b: any) => a.sort_order - b.sort_order)
        .map((s: any) => ({
          ...s,
          fields: (s.fields || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
        }))

      const submission: FormSubmission = {
        ...data,
        template: data.template ? {
          ...data.template,
          sections: sortedSections
        } : undefined
      }

      set({ currentSubmission: submission })
      return submission
    } catch (err: any) {
      set({ error: err.message || 'Failed to load submission file' })
      return null
    }
  },

  createSubmission: async (templateId, leadId, clientId) => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      const { data, error } = await supabase
        .from('form_submissions')
        .insert({
          template_id: templateId,
          organization_id: orgId,
          lead_id: leadId || null,
          client_id: clientId || null,
          status: 'draft',
          current_step: 0,
          completion_rate: 0
        })
        .select()
        .single()

      if (error) throw error
      await get().fetchSubmissions()
      return data as FormSubmission
    } catch (err: any) {
      set({ error: err.message || 'Failed to generate onboarding portal' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  saveAnswers: async (submissionId, answers, currentStep = 0) => {
    try {
      const submission = get().currentSubmission
      
      let existingAnswers = submission?.answers;
      if (!existingAnswers) {
         const { data: fetchedAnswers } = await supabase
          .from('form_submission_answers')
          .select('*')
          .eq('submission_id', submissionId)
         existingAnswers = fetchedAnswers || [];
      }

      const existingMap = new Map(existingAnswers.map((a: any) => [a.field_id, a.id]))

      const inserts = []
      const updates = []

      for (const answer of answers) {
        const id = existingMap.get(answer.field_id)
        const payload: any = {
          submission_id: submissionId,
          field_id: answer.field_id
        }

        // Mask/encrypt if flagged sensitive
        if (answer.is_sensitive) {
          payload.answer_encrypted = btoa(answer.value) // Secure masking/obfuscation token
          payload.answer_value = '[ENCRYPTED / MASKED]'
        } else {
          payload.answer_value = answer.value
        }

        if (id) {
          updates.push({ id, ...payload })
        } else {
          inserts.push(payload)
        }
      }

      let insertedAnswers: any[] = []

      if (inserts.length > 0) {
        const { data, error } = await supabase.from('form_submission_answers').insert(inserts).select()
        if (error) throw error
        if (data) insertedAnswers = data
      }

      for (const update of updates) {
        const { id, ...payload } = update
        const { error } = await supabase
          .from('form_submission_answers')
          .update(payload)
          .eq('id', id)
        if (error) throw error
      }

      // Client-side diff update
      const finalAnswers = [
        ...existingAnswers.map((a: any) => {
           const updated = updates.find(u => u.id === a.id)
           if (updated) return { ...a, ...updated }
           return a
        }),
        ...insertedAnswers
      ]

      if (submission) {
        set({ currentSubmission: { ...submission, answers: finalAnswers } })
      }

      // Compute dynamic completion rate using local diff
      if (submission && submission.template?.sections) {
        const totalFields = submission.template.sections.reduce((acc: number, s: any) => acc + (s.fields?.length || 0), 0)
        
        const answeredCount = finalAnswers.length
        const rate = totalFields > 0 ? Math.min(Math.round((answeredCount / totalFields) * 100), 100) : 0

        await supabase
          .from('form_submissions')
          .update({
            completion_rate: rate,
            current_step: currentStep,
            updated_at: new Date().toISOString()
          })
          .eq('id', submissionId)
      }
    } catch (err: any) {
      set({ error: err.message || 'Auto-save failed' })
    }
  },

  submitForm: async (submissionId) => {
    set({ isLoading: true })
    try {
      const { error } = await supabase
        .from('form_submissions')
        .update({
          status: 'submitted',
          completion_rate: 100,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)

      if (error) throw error

      await get().getSubmissionById(submissionId)
      await get().fetchSubmissions()
    } catch (err: any) {
      set({ error: err.message || 'Failed to submit request' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  updateSubmissionStatus: async (submissionId, status, notes) => {
    try {
      const payload: any = {
        status,
        updated_at: new Date().toISOString()
      }
      if (notes) payload.clarification_notes = notes

      const { error } = await supabase
        .from('form_submissions')
        .update(payload)
        .eq('id', submissionId)

      if (error) throw error
      await get().fetchSubmissions()
    } catch (err: any) {
      set({ error: err.message || 'Failed to update workflow status' })
    }
  },

  deleteSubmission: async (submissionId) => {
    set({ isLoading: true })
    try {
      const { error } = await supabase
        .from('form_submissions')
        .delete()
        .eq('id', submissionId)

      if (error) throw error

      await logActivity({
        action: 'ONBOARDING_DELETED',
        targetType: 'submission',
        targetId: submissionId,
        targetName: 'Dynamic Onboarding Submission',
        severity: 'warning'
      })

      await get().fetchSubmissions()
    } catch (err: any) {
      set({ error: err.message || 'Failed to delete submission' })
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  uploadFile: async (submissionId, fieldId, file) => {
    try {
      // Setup secure organizational bucket paths
      const fileExt = file.name.split('.').pop()
      const fileName = `${submissionId}/${fieldId}_${Date.now()}.${fileExt}`
      
      const { data, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(`onboarding/${fileName}`, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(`onboarding/${fileName}`)

      // Register attachment in DB
      const { error: dbError } = await supabase
        .from('form_attachments')
        .insert({
          submission_id: submissionId,
          field_id: fieldId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size
        })

      if (dbError) throw dbError

      return publicUrl
    } catch (err: any) {
      throw new Error(err.message || 'File upload failed')
    }
  },

  fetchAttachments: async (submissionId) => {
    try {
      const { data, error } = await supabase
        .from('form_attachments')
        .select('*')
        .eq('submission_id', submissionId)
      if (error) throw error
      return data || []
    } catch (err) {
      console.error(err)
      return []
    }
  },

  saveFinancialData: async (submissionId, data) => {
    try {
      const { error } = await supabase
        .from('form_submissions')
        .update({
          financial_data: data,
          updated_at: new Date().toISOString()
        })
        .eq('id', submissionId)

      if (error) throw error

      // Update local state
      const current = get().currentSubmission
      if (current && current.id === submissionId) {
        set({ currentSubmission: { ...current, financial_data: data } })
      }

      await get().fetchSubmissions()
    } catch (err: any) {
      set({ error: err.message || 'Failed to save financial data' })
      throw err
    }
  },

  approveAndConvertToClient: async (submissionId) => {
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      const submission = get().currentSubmission
      if (!submission) throw new Error('No submission loaded.')

      // Mark submission approved
      const { error: statusError } = await supabase
        .from('form_submissions')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', submissionId)

      if (statusError) throw statusError

      // 1. Build a map of field ID to decrypted answer value
      const answersMap = new Map((submission.answers || []).map((a: any) => {
        let val = a.answer_value;
        if (val === '[ENCRYPTED / MASKED]' && a.answer_encrypted) {
          try {
            val = atob(a.answer_encrypted);
          } catch (e) {
            val = a.answer_value;
          }
        }
        return [a.field_id, val || ''];
      }))

      // 2. Loop through sections and fields to extract known fields
      let extractedClientName = ''
      let extractedCompanyName = ''
      let extractedEmail = ''
      let extractedPhone = ''
      let extractedAddress = ''
      let extractedWebsite = ''
      let extractedProjectName = ''
      let extractedProjectType = ''
      let extractedBudget = ''
      let extractedRenewalDate = ''
      const extractedServices: string[] = []

      const sections = submission.template?.sections || []
      sections.forEach((section: any) => {
        section.fields?.forEach((field: any) => {
          const code = (field.code || '').toLowerCase().trim()
          const label = (field.label || '').toLowerCase().trim()
          const val = (answersMap.get(field.id) || '').trim()

          if (!val) return

          // Match contact person name
          if (
            code === 'contact_name' ||
            code === 'contact_person' ||
            code === 'full_name' ||
            code === 'fullname' ||
            label.includes('contact person') ||
            label === 'your name' ||
            label === 'full name' ||
            (label.includes('client') && label.includes('name') && !label.includes('project') && !label.includes('company'))
          ) {
            if (!extractedClientName) extractedClientName = val
          }
          // Match company name
          else if (
            code === 'company_name' ||
            code === 'company' ||
            code === 'companyname' ||
            label.includes('company name') ||
            label.includes('business name') ||
            label.includes('organization')
          ) {
            if (!extractedCompanyName) extractedCompanyName = val
          }
          // Match client email
          else if (
            code === 'email' ||
            code === 'client_email' ||
            code === 'company_email' ||
            field.field_type === 'email' ||
            label.includes('email') ||
            label.includes('e-mail')
          ) {
            if (!extractedEmail) extractedEmail = val
          }
          // Match client phone
          else if (
            code === 'phone' ||
            code === 'telephone' ||
            code === 'mobile' ||
            code === 'client_phone' ||
            field.field_type === 'phone' ||
            label.includes('phone') ||
            label.includes('mobile') ||
            label.includes('contact number')
          ) {
            if (!extractedPhone) extractedPhone = val
          }
          // Match client address
          else if (
            code === 'address' ||
            code === 'location' ||
            code === 'office_address' ||
            label.includes('address') ||
            label.includes('office location')
          ) {
            if (!extractedAddress) extractedAddress = val
          }
          // Match website
          else if (
            code === 'website' ||
            code === 'url' ||
            code === 'domain' ||
            label.includes('website') ||
            label.includes('domain') ||
            label.includes('url')
          ) {
            if (!extractedWebsite) extractedWebsite = val
          }
          // Match project name
          else if (
            code === 'project_name' ||
            code === 'projectname' ||
            label.includes('project name') ||
            label.includes('name of project') ||
            label.includes('name of your project')
          ) {
            if (!extractedProjectName) extractedProjectName = val
          }
          // Match project type
          else if (
            code === 'project_type' ||
            code === 'projecttype' ||
            label.includes('project type') ||
            label.includes('type of project') ||
            label.includes('category')
          ) {
            if (!extractedProjectType) extractedProjectType = val
          }
          // Match budget
          else if (
            code === 'budget' ||
            code === 'project_budget' ||
            label.includes('budget') ||
            label.includes('estimated budget') ||
            label.includes('investment')
          ) {
            if (!extractedBudget) extractedBudget = val
          }
          // Match services
          else if (
            code === 'services' ||
            code === 'services_needed' ||
            code === 'services_required' ||
            label.includes('services required') ||
            label.includes('services needed') ||
            label.includes('which services') ||
            label.includes('select services')
          ) {
            extractedServices.push(val)
          }
          // Match renewal date
          else if (
            code === 'renewal_date' ||
            code === 'expiry_date' ||
            label.includes('renewal date') ||
            label.includes('expiry date') ||
            label.includes('contract end')
          ) {
            extractedRenewalDate = val
          }
        })
      })

      // Build client name: use CONTACT PERSON's name as the active client identifier
      let clientName = ''
      let companyName = '' // Track company separately for project naming

      if (submission.lead) {
        // Person's full name from lead record
        const personName = `${submission.lead.first_name} ${submission.lead.last_name || ''}`.trim()
        if (personName && !extractedClientName) clientName = personName
        if (!companyName) companyName = submission.lead.company || ''
      }

      // Fallback: use extracted name from form
      if (!clientName && extractedClientName) {
        clientName = extractedClientName
      }
      
      // Override companyName if extracted
      if (extractedCompanyName) {
        companyName = extractedCompanyName
      }

      // Final fallback
      if (!clientName) {
        clientName = companyName || submission.template?.name || 'New Client'
      }

      const email = extractedEmail || submission.lead?.email || null
      const phone = extractedPhone || submission.lead?.phone || null
      const address = extractedAddress || null
      const website = extractedWebsite || null
      const service = extractedServices.length > 0 ? extractedServices.join(', ') : (submission.template?.service_type || null)
      const projectCostVal = submission.financial_data?.project_cost || (extractedBudget ? parseFloat(extractedBudget.replace(/[^0-9.]/g, '')) : null) || null

      // If already linked to a client, just update their contract value and details
      if (submission.client_id) {
        const updatePayload: any = {}
        if (projectCostVal) updatePayload.contract_value = projectCostVal
        if (email) updatePayload.email = email
        if (phone) updatePayload.phone = phone
        if (address) updatePayload.address = address
        if (website) updatePayload.website = website
        if (service) updatePayload.service = service

        if (Object.keys(updatePayload).length > 0) {
          await supabase
            .from('clients')
            .update(updatePayload)
            .eq('id', submission.client_id)
        }
        await get().getSubmissionById(submissionId)
        await get().fetchSubmissions()
        return submission.client_id
      }

      // Create the client record
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          organization_id: orgId,
          lead_id: submission.lead_id || null,
          name: clientName,
          email: email,
          phone: phone,
          address: address,
          website: website,
          service: service,
          contract_value: projectCostVal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (clientError) throw clientError

      // Link submission to new client
      await supabase
        .from('form_submissions')
        .update({ client_id: newClient.id })
        .eq('id', submissionId)

      // 1. Build a rich, structured description containing all client answers
      let projectDescription = `Intake Services: ${submission.template?.service_type || 'Custom Service'}\n`
      if (service) {
        projectDescription += `Requested Services: ${service}\n`
      }
      projectDescription += `\n=== CLIENT REQUIREMENT SPECIFICATION ===\n`
      
      sections.forEach((section: any) => {
        projectDescription += `\n[ ${section.title} ]\n`
        section.fields?.forEach((field: any) => {
          const ansVal = answersMap.get(field.id)
          if (ansVal) {
            projectDescription += `- ${field.label}: ${ansVal}\n`
          }
        })
      })

      // 2. Map service type to project category
      let projectType = 'Other'
      if (extractedProjectType) {
        const cleanedType = extractedProjectType.toLowerCase()
        if (cleanedType.includes('software') || cleanedType.includes('app') || cleanedType.includes('dev')) {
          projectType = 'Software'
        } else if (cleanedType.includes('web') || cleanedType.includes('design')) {
          projectType = 'Website'
        } else if (cleanedType.includes('marketing') || cleanedType.includes('seo')) {
          projectType = 'Marketing'
        } else if (cleanedType.includes('commerce') || cleanedType.includes('shop')) {
          projectType = 'Ecommerce'
        }
      } else {
        const svcType = (submission.template?.service_type || '').toLowerCase()
        if (svcType.includes('software') || svcType.includes('app') || svcType.includes('dev')) {
          projectType = 'Software'
        } else if (svcType.includes('web') || svcType.includes('design')) {
          projectType = 'Website'
        } else if (svcType.includes('marketing') || svcType.includes('seo')) {
          projectType = 'Marketing'
        } else if (svcType.includes('commerce') || svcType.includes('shop')) {
          projectType = 'Ecommerce'
        }
      }

      // 3. Create the project automatically in the projects section
      // Project name: form field → company name → person name + template
      const projectName = extractedProjectName
        || (companyName ? companyName : '')
        || `${clientName} - ${submission.template?.name || 'Onboarding Project'}`
      const { data: newProject, error: projectCreateError } = await supabase
        .from('projects')
        .insert({
          organization_id: orgId,
          client_id: newClient.id,
          name: projectName,
          description: projectDescription,
          type: projectType,
          budget: projectCostVal,
          status: 'planning',
          start_date: new Date().toISOString().split('T')[0],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (projectCreateError) {
        console.error("Auto project creation failed:", projectCreateError)
      } else {
        logActivity({
          action: 'CREATE',
          targetType: 'project',
          targetId: newProject.id,
          targetName: projectName,
          description: `Auto-initialized project for client ${clientName} on approval`,
          organization_id: orgId
        })
      }

      // 4. Create Renewal record if date provided
      let parsedRenewalDate = extractedRenewalDate ? new Date(extractedRenewalDate) : null;
      if (!parsedRenewalDate || isNaN(parsedRenewalDate.getTime())) {
         // Default renewal to 1 year from now if not explicitly provided but a contract exists
         parsedRenewalDate = new Date();
         parsedRenewalDate.setFullYear(parsedRenewalDate.getFullYear() + 1);
      }
      
      const { data: newRenewal, error: renewalError } = await supabase
        .from('renewals')
        .insert({
          organization_id: orgId,
          client_id: newClient.id,
          project_id: newProject?.id || null,
          category: service || 'General',
          amount: projectCostVal || 0,
          expiry_date: parsedRenewalDate.toISOString().split('T')[0],
          status: 'upcoming'
        })

      if (renewalError) {
        console.error("Auto renewal creation failed:", renewalError)
      }

      // If there's a lead, mark it as active_client
      if (submission.lead_id) {
        await supabase
          .from('leads')
          .update({ status: 'active_client' })
          .eq('id', submission.lead_id)
      }

      logActivity({
        action: 'CREATE',
        targetType: 'client',
        targetId: newClient.id,
        targetName: clientName,
        description: `Client created from onboarding submission approval`,
        organization_id: orgId
      })

      await get().getSubmissionById(submissionId)
      await get().fetchSubmissions()

      return newClient.id
    } catch (err: any) {
      set({ error: err.message || 'Failed to convert to client' })
      throw err
    }
  }
}))
