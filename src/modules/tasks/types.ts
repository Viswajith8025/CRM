export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';
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
  created_at: string
  updated_at: string
  project?: { name: string }
  assignee?: { full_name: string, avatar_url: string }
  comments?: { count: number }[]
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
