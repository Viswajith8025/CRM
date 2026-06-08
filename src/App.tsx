import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { ThemeProvider } from '@/hooks/useTheme'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { GlobalErrorBoundary } from '@/components/shared/GlobalErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import Dashboard from '@/pages/Dashboard'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ProfilePage from '@/pages/ProfilePage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import CRMPage from '@/modules/crm/pages/CRMPage'
import ClientsPage from '@/modules/crm/pages/ClientsPage'
import ProposalDetail from '@/modules/crm/pages/ProposalDetail'
import ProjectsPage from '@/modules/projects/pages/ProjectsPage'
import ProjectDetailPage from '@/modules/projects/pages/ProjectDetailPage'
import TasksPage from '@/modules/tasks/pages/TasksPage'

import BillingPage from '@/modules/billing/pages/BillingPage'
import InvoiceDetail from '@/modules/billing/pages/InvoiceDetail'
import ClientStatementsPage from '@/modules/billing/pages/ClientStatementsPage'
import { ClientLayout } from '@/modules/client-portal/layout/ClientLayout'
import ClientDashboard from '@/modules/client-portal/pages/ClientDashboard'
import ClientProjects from '@/modules/client-portal/pages/ClientProjects'
import ClientInvoices from '@/modules/client-portal/pages/ClientInvoices'
import ClientVaultPage from '@/modules/client-portal/pages/ClientVaultPage'
import ProfitabilityReport from '@/modules/reports/pages/ProfitabilityReport'
import ReportsPage from '@/modules/reports/pages/ReportsPage'
import InvoiceReport from '@/modules/reports/pages/InvoiceReport'
import AttendanceReport from '@/modules/reports/pages/AttendanceReport'
import TaskReport from '@/modules/reports/pages/TaskReport'
import ClientReport from '@/modules/reports/pages/ClientReport'
import ProjectReport from '@/modules/reports/pages/ProjectReport'
import SuperAdminDashboard from '@/modules/admin/pages/SuperAdminDashboard'
import SettingsPage from '@/modules/admin/pages/SettingsPage'
import TeamPage from '@/modules/admin/pages/TeamPage'
import NotificationsPage from '@/modules/notifications/pages/NotificationsPage'
import HRDashboard from '@/modules/hr/pages/HRDashboard'
import { CommandPalette } from '@/components/shared/CommandPalette'
import CalendarPage from '@/modules/calendar/pages/CalendarPage'
import RolesPage from '@/modules/admin/pages/RolesPage'
import RolePermissionEditor from '@/modules/admin/pages/RolePermissionEditor'
import CRMReport from '@/modules/reports/pages/CRMReport'
import EmployeeReport from '@/modules/reports/pages/EmployeeReport'
import LeaveReport from '@/modules/reports/pages/LeaveReport'
import ExpenseReport from '@/modules/reports/pages/ExpenseReport'
import PaymentReport from '@/modules/reports/pages/PaymentReport'
import LeadReport from '@/modules/reports/pages/LeadReport'
import RenewalsPage from '@/modules/renewals/pages/RenewalsPage'
import RenewalsReport from '@/modules/reports/pages/RenewalsReport'
import TimeDeskMonitor from '@/modules/time-tracking/pages/TimeDeskMonitor'
import MyTimesheetPage from '@/modules/time-tracking/pages/MyTimesheetPage'
import TeamTimesheetsPage from '@/modules/time-tracking/pages/TeamTimesheetsPage'
import LeaveRequestsPage from '@/modules/hr/pages/LeaveRequestsPage'
import LeaveApprovalsPage from '@/modules/hr/pages/LeaveApprovalsPage'
import { FormManagerDashboard, FormBuilder, PremiumOnboardingPortal, SubmissionReview } from '@/modules/forms'
import AttendanceDevicePage from '@/modules/attendance/pages/AttendanceDevicePage'

function App() {
  useRealtimeSync()
  const { setSession, subscribeToProfile } = useAuthStore()

  useEffect(() => {
    let unsubProfileChannel: (() => void) | undefined
    let unsubRBACChannel: (() => void) | undefined

    // Listen for auth changes - deduplicated to avoid rapid fire events during initialization
    let lastProcessedSession = ""
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionKey = session?.access_token || "none"
      if (sessionKey === lastProcessedSession) return
      lastProcessedSession = sessionKey

      setSession(session)
      if (unsubProfileChannel) unsubProfileChannel()
      if (unsubRBACChannel) unsubRBACChannel()
      if (session?.user) {
        unsubProfileChannel = subscribeToProfile()
        // Wire ONE RBAC singleton channel for this user — HP-03 fix
        import('@/modules/admin/rbacStore').then(m => {
          const store = m.useRBACStore.getState()
          store.fetchUserPermissions(session.user.id)
          unsubRBACChannel = store.initRBACSubscription(session.user.id)
        })
      }
    })

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      const sessionKey = session?.access_token || "none"
      if (sessionKey === lastProcessedSession) return
      lastProcessedSession = sessionKey
      
      setSession(session)
      if (session?.user) {
        unsubProfileChannel = subscribeToProfile()
        import('@/modules/admin/rbacStore').then(m => {
          const store = m.useRBACStore.getState()
          store.fetchUserPermissions(session.user.id)
          unsubRBACChannel = store.initRBACSubscription(session.user.id)
        })
      }
    }).catch(() => setSession(null))

    return () => {
      subscription.unsubscribe()
      if (unsubProfileChannel) unsubProfileChannel()
      if (unsubRBACChannel) unsubRBACChannel()
    }
  }, [])

  return (
    <GlobalErrorBoundary>
      <ThemeProvider defaultTheme="light" storageKey="erp-theme">
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/crm/onboarding/portal/:id" element={<ErrorBoundary module="Onboarding Portal"><PremiumOnboardingPortal /></ErrorBoundary>} />


            {/* Standard Protected Routes (Open to all authenticated users) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/" element={<ErrorBoundary module="Dashboard"><Dashboard /></ErrorBoundary>} />
                <Route path="/profile" element={<ErrorBoundary module="Profile"><ProfilePage /></ErrorBoundary>} />
                <Route path="/notifications" element={<ErrorBoundary module="Notifications"><NotificationsPage /></ErrorBoundary>} />
                <Route path="/leave-requests" element={<ErrorBoundary module="Leave Requests"><LeaveRequestsPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Project Module Routes */}
            <Route element={<ProtectedRoute permission="module.projects" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/projects" element={<ErrorBoundary module="Projects"><ProjectsPage /></ErrorBoundary>} />
                <Route path="/projects/:id" element={<ErrorBoundary module="Project Details"><ProjectDetailPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Task Module Routes */}
            <Route element={<ProtectedRoute permission="module.tasks" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/tasks" element={<ErrorBoundary module="Tasks"><TasksPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Calendar Module Routes */}
            <Route element={<ProtectedRoute permission="module.calendar" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/calendar" element={<ErrorBoundary module="Calendar"><CalendarPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Timesheet Module Routes */}
            <Route element={<ProtectedRoute permission="module.timesheet" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/timesheet" element={<ErrorBoundary module="My Timesheet"><MyTimesheetPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* HR / Employee Directory Module Routes */}
            <Route element={<ProtectedRoute permission="module.hr" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/hr" element={<ErrorBoundary module="HR"><HRDashboard /></ErrorBoundary>} />
                <Route path="/teams" element={<ErrorBoundary module="Teams"><TeamPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Leave Approvals Routes */}
            <Route element={<ProtectedRoute permission="leave.approval.view" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/leave-approvals" element={<ErrorBoundary module="Leave Approvals"><LeaveApprovalsPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* CRM / Sales Module Routes */}
            <Route element={<ProtectedRoute permission="module.crm" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/crm" element={<ErrorBoundary module="CRM"><CRMPage /></ErrorBoundary>} />
                <Route path="/clients" element={<ErrorBoundary module="Clients"><ClientsPage /></ErrorBoundary>} />
                <Route path="/proposals/:id" element={<ErrorBoundary module="Proposal Details"><ProposalDetail /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Dynamic Client Onboarding Routes */}
            <Route element={<ProtectedRoute permission="module.forms" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/crm/onboarding" element={<ErrorBoundary module="Onboarding Dashboard"><FormManagerDashboard /></ErrorBoundary>} />
                <Route path="/crm/onboarding/builder" element={<ErrorBoundary module="Form Builder"><FormBuilder /></ErrorBoundary>} />
                <Route path="/crm/onboarding/review/:id" element={<ErrorBoundary module="Submission Review"><SubmissionReview /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Billing / Invoices / Financials Routes */}
            <Route element={<ProtectedRoute permission="module.billing" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                 <Route path="/billing" element={<ErrorBoundary module="Billing"><BillingPage /></ErrorBoundary>} />
                 <Route path="/billing/statements" element={<ErrorBoundary module="Client Statements"><ClientStatementsPage /></ErrorBoundary>} />
                 <Route path="/renewals" element={<ErrorBoundary module="Renewals"><RenewalsPage /></ErrorBoundary>} />
                 <Route path="/billing/:id" element={<ErrorBoundary module="Invoice Details"><InvoiceDetail /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Reports & Analytics Routes */}
            <Route element={<ProtectedRoute permission="module.reports" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/reports" element={<ErrorBoundary module="Reports"><ReportsPage /></ErrorBoundary>} />
                <Route path="/reports/crm" element={<ErrorBoundary module="CRM Analytics"><CRMReport /></ErrorBoundary>} />
                <Route path="/reports/employees" element={<ErrorBoundary module="Employee Report"><EmployeeReport /></ErrorBoundary>} />
                <Route path="/reports/leaves" element={<ErrorBoundary module="Leave Report"><LeaveReport /></ErrorBoundary>} />
                <Route path="/reports/attendance" element={<ErrorBoundary module="Attendance Report"><AttendanceReport /></ErrorBoundary>} />
                <Route path="/reports/invoices" element={<ErrorBoundary module="Invoice Report"><InvoiceReport /></ErrorBoundary>} />
                <Route path="/reports/expense" element={<ErrorBoundary module="Expense Report"><ExpenseReport /></ErrorBoundary>} />
                <Route path="/reports/payments" element={<ErrorBoundary module="Payment Report"><PaymentReport /></ErrorBoundary>} />
                <Route path="/reports/tasks" element={<ErrorBoundary module="Task Report"><TaskReport /></ErrorBoundary>} />
                <Route path="/reports/clients" element={<ErrorBoundary module="Client Report"><ClientReport /></ErrorBoundary>} />
                <Route path="/reports/projects" element={<ErrorBoundary module="Project Report"><ProjectReport /></ErrorBoundary>} />
                <Route path="/reports/renewals-audit" element={<ErrorBoundary module="Renewals Report"><RenewalsReport /></ErrorBoundary>} />
                <Route path="/reports/leads" element={<ErrorBoundary module="Lead Report"><LeadReport /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Admin Management Routes */}
            <Route element={<ProtectedRoute permission="module.admin" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/settings" element={<ErrorBoundary module="Settings"><SettingsPage /></ErrorBoundary>} />
                <Route path="/time-monitor" element={<ErrorBoundary module="Time Monitor"><TimeDeskMonitor /></ErrorBoundary>} />
                <Route path="/reports/profitability" element={<ErrorBoundary module="Profitability"><ProfitabilityReport /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Team Timesheets & Time Tracking Routes */}
            <Route element={<ProtectedRoute permission="module.team_timesheets" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                
                <Route path="/team-timesheets" element={<ErrorBoundary module="Team Timesheets"><TeamTimesheetsPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Attendance Module Routes */}
            <Route element={<ProtectedRoute permission="module.attendance" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/attendance" element={<ErrorBoundary module="Attendance"><AttendanceDevicePage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Roles & Access Module Routes */}
            <Route element={<ProtectedRoute permission="roles.manage" />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/roles" element={<ErrorBoundary module="Roles"><RolesPage /></ErrorBoundary>} />
                <Route path="/roles/:id" element={<ErrorBoundary module="Role Editor"><RolePermissionEditor /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Super Admin Routes */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/super-admin" element={<ErrorBoundary module="Super Admin"><SuperAdminDashboard /></ErrorBoundary>} />
              </Route>
            </Route>


            {/* Client Portal Routes */}
            <Route path="/portal" element={<ClientLayout />}>
              <Route index element={<ErrorBoundary module="Client Portal"><ClientDashboard /></ErrorBoundary>} />
              <Route path="projects" element={<ErrorBoundary module="Client Projects"><ClientProjects /></ErrorBoundary>} />
              <Route path="invoices" element={<ErrorBoundary module="Client Invoices"><ClientInvoices /></ErrorBoundary>} />
              <Route path="vault" element={<ErrorBoundary module="Client Vault"><ClientVaultPage /></ErrorBoundary>} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
          <CommandPalette />
          <ReactQueryDevtools initialIsOpen={false} />
        </Router>
      </ThemeProvider>
    </GlobalErrorBoundary>
  )
}

export default App
