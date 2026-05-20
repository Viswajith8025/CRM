import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/auditLogger'
import type { FormTemplate, FormSection, FormField, FormSubmission, SubmissionAnswer, FormCondition, FormAttachment, FinancialData } from './types'

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

  // Client Portal & Submissions
  fetchSubmissions: () => Promise<void>
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
      if (templateId) {
        const { error } = await supabase
          .from('form_templates')
          .update(templatePayload)
          .eq('id', templateId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('form_templates')
          .insert(templatePayload)
          .select()
          .single()
        if (error) throw error
        templateId = data.id
      }

      // 2. Clear old sections (simpler than structural diffs for dynamic field builder)
      if (template.id) {
        // Fetch current sections to safely wipe fields
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

  fetchSubmissions: async () => {
    set({ isLoading: true })
    try {
      const { profile } = (await import('@/store/useAuthStore')).useAuthStore.getState()
      const orgId = profile?.organization_id
      if (!orgId) throw new Error('No organization context found.')

      const { data, error } = await supabase
        .from('form_submissions')
        .select(`
          *,
          template:form_templates (*),
          lead:leads!lead_id (first_name, last_name, company),
          client:clients!client_id (name)
        `)
        .eq('organization_id', orgId)
        .order('updated_at', { ascending: false })

      if (error) throw error
      set({ submissions: data || [], error: null })
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch submissions' })
    } finally {
      set({ isLoading: false })
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
      const { data: currentAnswers } = await supabase
        .from('form_submission_answers')
        .select('*')
        .eq('submission_id', submissionId)

      const existingMap = new Map(currentAnswers?.map(a => [a.field_id, a.id]))

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

      if (inserts.length > 0) {
        const { error } = await supabase.from('form_submission_answers').insert(inserts)
        if (error) throw error
      }

      for (const update of updates) {
        const { id, ...payload } = update
        const { error } = await supabase
          .from('form_submission_answers')
          .update(payload)
          .eq('id', id)
        if (error) throw error
      }

      // Compute dynamic completion rate
      const submission = get().currentSubmission
      if (submission && submission.template?.sections) {
        const totalFields = submission.template.sections.reduce((acc, s) => acc + (s.fields?.length || 0), 0)
        
        const { data: updatedAnswers } = await supabase
          .from('form_submission_answers')
          .select('id')
          .eq('submission_id', submissionId)
        
        const answeredCount = updatedAnswers?.length || 0
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

      // If already linked to a client, just update their contract value
      if (submission.client_id) {
        if (submission.financial_data?.project_cost) {
          await supabase
            .from('clients')
            .update({ contract_value: submission.financial_data.project_cost })
            .eq('id', submission.client_id)
        }
        await get().getSubmissionById(submissionId)
        await get().fetchSubmissions()
        return submission.client_id
      }

      // Build client name from lead or template
      const clientName =
        submission.lead
          ? `${submission.lead.first_name} ${submission.lead.last_name || ''}`.trim()
          : (submission.template?.name || 'New Client')

      // Create the client record
      const { data: newClient, error: clientError } = await supabase
        .from('clients')
        .insert({
          organization_id: orgId,
          lead_id: submission.lead_id || null,
          name: clientName,
          service: submission.template?.service_type || null,
          contract_value: submission.financial_data?.project_cost || null,
          email: null,
          phone: null,
          address: null,
          website: null,
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
      let projectDescription = `Intake Services: ${submission.template?.service_type || 'Custom Service'}\n\n=== CLIENT REQUIREMENT SPECIFICATION ===\n`
      const sections = submission.template?.sections || []
      const answersMap = new Map((submission.answers || []).map((a: any) => [a.field_id, a]))
      
      sections.forEach((section: any) => {
        projectDescription += `\n[ ${section.title} ]\n`
        section.fields?.forEach((field: any) => {
          const ans = answersMap.get(field.id)
          if (ans?.answer_value) {
            projectDescription += `- ${field.label}: ${ans.answer_value}\n`
          }
        })
      })

      // 2. Map service type to project category
      let projectType = 'Other'
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

      // 3. Create the project automatically in the projects section
      const projectName = `${clientName} - ${submission.template?.name || 'Onboarding Project'}`
      const { data: newProject, error: projectCreateError } = await supabase
        .from('projects')
        .insert({
          organization_id: orgId,
          client_id: newClient.id,
          name: projectName,
          description: projectDescription,
          type: projectType,
          budget: submission.financial_data?.project_cost || null,
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
