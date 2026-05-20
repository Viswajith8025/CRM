export interface FormTemplate {
  id: string
  organization_id: string
  name: string
  service_type: string
  description: string
  version: number
  status: 'active' | 'draft' | 'archived'
  is_system: boolean
  created_at: string
  updated_at: string
  sections?: FormSection[]
}

export interface FormSection {
  id: string
  template_id: string
  title: string
  description?: string
  sort_order: number
  created_at: string
  fields?: FormField[]
}

export interface FormField {
  id: string
  section_id: string
  code: string
  label: string
  placeholder?: string
  field_type: 
    | 'text' | 'textarea' | 'dropdown' | 'radio' | 'multiselect' | 'datepicker' 
    | 'file' | 'image' | 'url' | 'password' | 'dynamic_repeater' | 'conditional_section'
  is_required: boolean
  is_sensitive: boolean
  sort_order: number
  config: {
    options?: string[] // For dropdowns, multi-select, and radios
    repeater_fields?: { code: string; label: string; field_type: 'text' | 'url' }[] // For dynamic repeaters
    max_file_size?: number
    allowed_extensions?: string[]
  }
  created_at: string
}

export interface FinancialData {
  project_cost: number
  paid_amount: number
  balance: number
  payment_status: 'unpaid' | 'partial' | 'paid'
  notes: string
}

export interface FormSubmission {
  id: string
  template_id: string
  organization_id: string
  client_id?: string
  lead_id?: string
  status: 'draft' | 'submitted' | 'under_review' | 'clarification_needed' | 'approved'
  completion_rate: number
  current_step: number
  assigned_department_id?: string
  assigned_user_id?: string
  clarification_notes?: string
  financial_data?: FinancialData | null
  created_at: string
  updated_at: string
  template?: FormTemplate
  answers?: SubmissionAnswer[]
  lead?: { first_name: string; last_name: string; company?: string }
  client?: { name: string; company?: string }
}

export interface SubmissionAnswer {
  id: string
  submission_id: string
  field_id: string
  answer_value?: string
  answer_encrypted?: string
}

export interface FormCondition {
  id: string
  field_id: string
  trigger_field_id: string
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty'
  value?: string
  action: 'show' | 'hide' | 'require' | 'disable'
  created_at: string
}

export interface FormAttachment {
  id: string
  submission_id: string
  field_id: string
  file_name: string
  file_url: string
  file_size: number
  uploaded_at: string
}
