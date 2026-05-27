export type ProjectStatus = 'planning' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

export interface Project {
  remarks?: string;
  id: string
  user_id: string
  name: string
  type: 'Software' | 'Website' | 'Marketing' | 'Ecommerce' | 'Other'
  description: string | null
  client_id: string | null
  status: ProjectStatus
  start_date: string | null
  end_date: string | null
  budget: number | null
  created_at: string
  updated_at: string
  department_id?: string | null
  client?: { name: string } // Joined data
  task_stats?: {
    total: number
    completed: number
  }
  owner?: { full_name: string, avatar_url: string }
  lead?: { id: string, full_name: string, email: string }
  members?: { user_id: string, role: 'lead' | 'member', profiles: { full_name: string, email: string } }[]
  health?: {
    score: number
    status: 'on-track' | 'at-risk' | 'delayed'
    overdue_tasks: number
    missed_milestones: number
    budget_burn: number
  }
  financials?: {
    revenue: number
    labor_cost: number
    expense_total: number
    profit: number
    profit_margin: number
  }
}

export interface ProjectMember {
  project_id: string
  user_id: string
  role: 'lead' | 'member'
}

export interface Milestone {
  id: string
  project_id: string
  title: string
  description: string | null
  due_date: string | null
  status: 'pending' | 'completed'
  created_at: string
}
