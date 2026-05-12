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

import CRMPage from '@/modules/crm/pages/CRMPage'
import ClientsPage from '@/modules/crm/pages/ClientsPage'
import ProposalDetail from '@/modules/crm/pages/ProposalDetail'
import ProjectsPage from '@/modules/projects/pages/ProjectsPage'
import ProjectDetailPage from '@/modules/projects/pages/ProjectDetailPage'
import TasksPage from '@/modules/tasks/pages/TasksPage'
import TimeTrackingPage from '@/modules/time-tracking/pages/TimeTrackingPage'
import BillingPage from '@/modules/billing/pages/BillingPage'
import InvoiceDetail from '@/modules/billing/pages/InvoiceDetail'
import { ClientLayout } from '@/modules/client-portal/layout/ClientLayout'
import ClientDashboard from '@/modules/client-portal/pages/ClientDashboard'
import ClientProjects from '@/modules/client-portal/pages/ClientProjects'
import ClientInvoices from '@/modules/client-portal/pages/ClientInvoices'
import ClientVaultPage from '@/modules/client-portal/pages/ClientVaultPage'
import ExecutiveDashboard from '@/modules/reports/pages/ExecutiveDashboard'
import ProfitabilityReport from '@/modules/reports/pages/ProfitabilityReport'
import ReportsPage from '@/modules/reports/pages/ReportsPage'
import InvoiceReport from '@/modules/reports/pages/InvoiceReport'
import AttendanceReport from '@/modules/reports/pages/AttendanceReport'
import TaskReport from '@/modules/reports/pages/TaskReport'
import AuditReport from '@/modules/reports/pages/AuditReport'
import ClientReport from '@/modules/reports/pages/ClientReport'
import ProjectReport from '@/modules/reports/pages/ProjectReport'
import SuperAdminDashboard from '@/modules/admin/pages/SuperAdminDashboard'
import SettingsPage from '@/modules/admin/pages/SettingsPage'
import TeamPage from '@/modules/admin/pages/TeamPage'
import AuditTrailPage from '@/modules/admin/pages/AuditTrailPage'
import DocumentVault from '@/modules/documents/pages/DocumentVault'
import NotificationsPage from '@/modules/notifications/pages/NotificationsPage'
import HRDashboard from '@/modules/hr/pages/HRDashboard'
import SupportDashboard from '@/modules/support/pages/SupportDashboard'
import TicketDetailPage from '@/modules/support/pages/TicketDetailPage'
import { CommandPalette } from '@/components/shared/CommandPalette'
import CalendarPage from '@/modules/calendar/pages/CalendarPage'

function App() {
  const { setSession, subscribeToProfile } = useAuthStore()

  useEffect(() => {
    let unsubscribe: (() => void) | undefined

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        unsubscribe = subscribeToProfile()
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (unsubscribe) unsubscribe()
      if (session?.user) {
        unsubscribe = subscribeToProfile()
      }
    })

    return () => {
      subscription.unsubscribe()
      if (unsubscribe) unsubscribe()
    }
  }, [])

  return (
    <GlobalErrorBoundary>
      <ThemeProvider defaultTheme="dark" storageKey="erp-theme">
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Standard Protected Routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/" element={<ErrorBoundary module="Dashboard"><Dashboard /></ErrorBoundary>} />
                <Route path="/tasks" element={<ErrorBoundary module="Tasks"><TasksPage /></ErrorBoundary>} />
                <Route path="/projects" element={<ErrorBoundary module="Projects"><ProjectsPage /></ErrorBoundary>} />
                <Route path="/projects/:id" element={<ErrorBoundary module="Project Details"><ProjectDetailPage /></ErrorBoundary>} />
                <Route path="/profile" element={<ErrorBoundary module="Profile"><ProfilePage /></ErrorBoundary>} />
                <Route path="/notifications" element={<ErrorBoundary module="Notifications"><NotificationsPage /></ErrorBoundary>} />
                <Route path="/calendar" element={<ErrorBoundary module="Calendar"><CalendarPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Manager/Admin Routes (Operations) */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin', 'admin', 'manager']} />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/crm" element={<ErrorBoundary module="CRM"><CRMPage /></ErrorBoundary>} />
                <Route path="/clients" element={<ErrorBoundary module="Clients"><ClientsPage /></ErrorBoundary>} />
                <Route path="/proposals/:id" element={<ErrorBoundary module="Proposal Details"><ProposalDetail /></ErrorBoundary>} />
                <Route path="/reports" element={<ErrorBoundary module="Reports"><ReportsPage /></ErrorBoundary>} />
                <Route path="/reports/invoices" element={<ErrorBoundary module="Invoice Report"><InvoiceReport /></ErrorBoundary>} />
                <Route path="/reports/attendance" element={<ErrorBoundary module="Attendance Report"><AttendanceReport /></ErrorBoundary>} />
                <Route path="/reports/tasks" element={<ErrorBoundary module="Task Report"><TaskReport /></ErrorBoundary>} />
                <Route path="/reports/audit" element={<ErrorBoundary module="Audit Report"><AuditReport /></ErrorBoundary>} />
                <Route path="/reports/clients" element={<ErrorBoundary module="Client Report"><ClientReport /></ErrorBoundary>} />
                <Route path="/reports/projects" element={<ErrorBoundary module="Project Report"><ProjectReport /></ErrorBoundary>} />
                <Route path="/support" element={<ErrorBoundary module="Support"><SupportDashboard /></ErrorBoundary>} />
                <Route path="/support/tickets/:id" element={<ErrorBoundary module="Ticket Details"><TicketDetailPage /></ErrorBoundary>} />
                <Route path="/time-tracking" element={<ErrorBoundary module="Time Tracking"><TimeTrackingPage /></ErrorBoundary>} />
                <Route path="/hr" element={<ErrorBoundary module="HR"><HRDashboard /></ErrorBoundary>} />
                <Route path="/documents" element={<ErrorBoundary module="Documents"><DocumentVault /></ErrorBoundary>} />
                <Route path="/teams" element={<ErrorBoundary module="Teams"><TeamPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Admin/Super Admin Only (Sensitive/Financial) */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin', 'admin']} />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/billing" element={<ErrorBoundary module="Billing"><BillingPage /></ErrorBoundary>} />
                <Route path="/billing/:id" element={<ErrorBoundary module="Invoice Details"><InvoiceDetail /></ErrorBoundary>} />
                <Route path="/reports/profitability" element={<ErrorBoundary module="Profitability"><ProfitabilityReport /></ErrorBoundary>} />
                <Route path="/executive" element={<ErrorBoundary module="Executive Overview"><ExecutiveDashboard /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary module="Settings"><SettingsPage /></ErrorBoundary>} />
                <Route path="/audit-trail" element={<ErrorBoundary module="Audit Trail"><AuditTrailPage /></ErrorBoundary>} />
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
        </Router>
      </ThemeProvider>
    </GlobalErrorBoundary>
  )
}

export default App
