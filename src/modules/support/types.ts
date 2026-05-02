export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'waiting_on_client' | 'resolved' | 'closed'
export type TicketCategory = 'bug' | 'feature_request' | 'billing' | 'general_inquiry'

export interface SupportTicket {
  id: string
  subject: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category: TicketCategory
  client_id: string | null
  assigned_to: string | null
  sla_deadline: string | null
  is_escalated: boolean
  organization_id?: string
  created_at: string
  updated_at: string
  
  // Relations
  client?: { name: string, email: string }
  assignee?: { full_name: string, avatar_url: string }
}

export interface TicketMessage {
  id: string
  ticket_id: string
  sender_id: string
  message: string
  is_internal_note: boolean
  created_at: string
  
  // Relations
  sender?: { full_name: string, avatar_url: string }
}

export interface KnowledgeArticle {
  id: string
  title: string
  content: string
  category: string
  is_published: boolean
  organization_id?: string
  created_at: string
  updated_at: string
}
