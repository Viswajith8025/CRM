export interface HREmployee {
  id: string
  user_id: string
  department: string | null
  designation: string | null
  base_salary: number
  join_date: string | null
  kpi_score: number
  organization_id?: string
  created_at: string
  updated_at: string
  profile?: { full_name: string, email: string, avatar_url: string, role: string, status: string }
}

export interface HRAttendance {
  id: string
  user_id: string
  date: string
  clock_in: string | null
  clock_out: string | null
  total_hours: number | null
  status: 'present' | 'absent' | 'half_day' | 'on_leave'
  organization_id?: string
  created_at: string
  profile?: { full_name: string, avatar_url: string }
}

export interface HRLeave {
  id: string
  user_id: string
  leave_type: 'sick' | 'casual' | 'annual' | 'unpaid'
  start_date: string
  end_date: string
  reason: string | null
  status: 'pending' | 'approved' | 'rejected'
  organization_id?: string
  created_at: string
  updated_at: string
  profile?: { full_name: string, avatar_url: string, email: string }
}

export interface HRPayroll {
  id: string
  user_id: string
  month: string
  year: number
  basic_pay: number
  allowances: number
  deductions: number
  net_pay: number
  status: 'draft' | 'paid'
  organization_id?: string
  created_at: string
  updated_at: string
  profile?: { full_name: string, avatar_url: string, email: string }
}
