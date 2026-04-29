export interface TimeLog {
  id: string
  task_id: string | null
  user_id: string
  description: string | null
  start_time: string
  end_time: string | null
  duration_minutes: number | null
  is_billable: boolean
  created_at: string
  task?: { title: string, project?: { name: string } }
}

export interface ActiveTimer {
  start_time: string
  task_id: string | null
  description: string
  is_billable: boolean
}
