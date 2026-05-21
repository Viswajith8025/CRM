// Valid DB enum: 'todo' | 'in_progress' | 'review' | 'done'
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'blocked' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string
  user_id: string
  project_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  priority: TaskPriority
  assigned_to: string | null
  due_date: string | null
  estimated_hours: number | null
  actual_hours: number | null
  blocked_reason: string | null
  module_id: string | null
  created_at: string
  updated_at: string
  is_overdue_completion?: boolean
  project?: { name: string }
  assignee?: { full_name: string, avatar_url: string }
  comments?: { count: number }[]
  collaborators?: string[] // User IDs assigned as co-owners
  dependencies?: string[]  // Task IDs this task depends on
  module?: { id: string, name: string, color: string }
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  is_completed: boolean
  organization_id?: string
  created_at?: string
}

export interface TaskComment {
  id: string
  task_id: string
  user_id: string
  content: string
  attachment_url?: string | null
  organization_id?: string
  created_at: string
  user?: { full_name: string, avatar_url: string }
}
