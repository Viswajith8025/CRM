export interface KPI {
  id: string;
  organization_id: string;
  department: string;
  kpi_key: string;
  name: string;
  data_source_rpc: string;
  visualization_type: 'metric_card' | 'line_chart' | 'bar_chart' | 'doughnut' | 'heatmap';
  is_active: boolean;
}

export interface DashboardLayout {
  id: string;
  organization_id: string;
  department: string;
  layout_config: any; // JSONB
}

export interface EmployeeSnapshot {
  id: string;
  user_id: string;
  department_id: string;
  snapshot_date: string;
  metrics: Record<string, any>;
}
