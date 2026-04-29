export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  id: string
  name: string
  description: string | null
  client_id: string | null
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  budget: number | null
  created_at: string
  updated_at: string
  client?: { name: string } // Joined data
}

export interface Milestone {
  id: string
  project_id: string
  title: string
  description: string | null
  due_date: string | null
  is_completed: boolean
  created_at: string
}
