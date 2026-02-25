// Domain types matching the backend API schemas

export interface Project {
  id: number;
  project_id: string;
  name: string;
  client: string;
  deal_value: number | null;
  budget_hours: number | null;
  hourly_rate: number | null;
  bonus_rate: number;
  status: "aktiv" | "pausiert" | "abgeschlossen";
  start_date: string | null;
  created_at: string;
  updated_at: string;
  total_hours: number;
  bonus_amount: number;
  remote_hours: number;
  onsite_hours: number;
  onsite_hourly_rate: number | null;
  project_manager: string | null;
  customer_contact: string | null;
}

export interface ProjectCreate {
  name: string;
  client: string;
  project_id: string;
  deal_value?: number | null;
  budget_hours?: number | null;
  hourly_rate?: number | null;
  bonus_rate?: number;
  status?: string;
  start_date?: string | null;
  onsite_hourly_rate?: number | null;
  project_manager?: string | null;
  customer_contact?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  client?: string;
  deal_value?: number | null;
  budget_hours?: number | null;
  hourly_rate?: number | null;
  bonus_rate?: number | null;
  status?: string;
  start_date?: string | null;
  onsite_hourly_rate?: number | null;
  project_manager?: string | null;
  customer_contact?: string | null;
}

export interface TimeEntry {
  id: number;
  project_id: number;
  date: string;
  duration_decimal: number;
  employee: string;
  description: string;
  start_time: string | null;
  end_time: string | null;
  month: string;
}

export interface ImportBatch {
  id: number;
  filename: string;
  imported_at: string;
  row_count: number;
}

export interface ImportResult {
  batch_id: number;
  rows_imported: number;
  projects_created: number;
  projects_updated: number;
}

// GET /api/reports/dashboard
export interface DashboardStats {
  active_projects: number;
  total_hours_current_month: number;
  total_bonus_current_month: number;
  projects: Project[];
  ytd_hours: number;
  ytd_bonus: number;
  ytd_revenue: number;
}

// GET /api/reports/finance?year=YYYY returns FinanceMonth[]
export interface MonthlyProjectReport {
  project_id: string;
  project_name: string;
  client: string;
  month: string;
  total_hours: number;
  remote_hours: number;
  onsite_hours: number;
  hourly_rate: number | null;
  onsite_hourly_rate: number | null;
  bonus_rate: number;
  bonus_amount: number;
}

export interface FinanceMonth {
  month: string;
  projects: MonthlyProjectReport[];
  total_hours: number;
  total_bonus: number;
}

// GET /api/reports/project/{id}
export interface ProjectReport {
  project: {
    id: number;
    project_id: string;
    name: string;
    client: string;
    budget_hours: number | null;
    hourly_rate: number | null;
    bonus_rate: number;
    status: string;
  };
  total_hours: number;
  total_bonus: number;
  budget_remaining: number | null;
  monthly_breakdown: Array<{
    month: string;
    hours: number;
    bonus: number;
  }>;
  employee_breakdown: Array<{
    employee: string;
    total_hours: number;
  }>;
}

// GET /api/reports/customer/{id}?month=YYYY-MM
export interface CustomerReportData {
  project_id: string;
  project_name: string;
  client: string;
  month: string;
  total_hours: number;
  budget_hours: number | null;
  hours_remaining: number | null;
  employees: Array<{
    employee: string;
    hours: number;
  }>;
  note: string;
}

// POST /api/reports/customer/{id}/notes?month=YYYY-MM
export interface CustomerReportNote {
  id: number;
  project_id: number;
  month: string;
  note: string;
}

// GET /api/reports/revenue
export interface RevenueProject {
  id: number;
  name: string;
  client: string;
  deal_value: number | null;
  budget_hours: number | null;
  total_hours: number;
  remote_hours: number;
  onsite_hours: number;
  hourly_rate: number | null;
  onsite_hourly_rate: number | null;
  revenue: number;
  budget_utilization: number | null;
  status: string;
}

export interface RevenueData {
  total_deal_value: number;
  total_revenue: number;
  avg_budget_utilization: number;
  active_projects: number;
  projects: RevenueProject[];
}

export interface ApiError {
  detail: string;
}
