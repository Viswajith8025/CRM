import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { ThemeProvider } from '@/hooks/useTheme'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import Dashboard from '@/pages/Dashboard'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ProfilePage from '@/pages/ProfilePage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'

import CRMPage from '@/modules/crm/pages/CRMPage'
import ClientsPage from '@/modules/crm/pages/ClientsPage'
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
import ReportsPage from '@/modules/reports/pages/ReportsPage'
import SettingsPage from '@/modules/admin/pages/SettingsPage'
import TeamPage from '@/modules/admin/pages/TeamPage'
import NotificationsPage from '@/modules/notifications/pages/NotificationsPage'
import HRDashboard from '@/modules/hr/pages/HRDashboard'
import SupportDashboard from '@/modules/support/pages/SupportDashboard'
import TicketDetailPage from '@/modules/support/pages/TicketDetailPage'

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
    <ThemeProvider defaultTheme="dark" storageKey="erp-theme">
      <ErrorBoundary module="ECRAFTZ Platform">
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Standard Protected Routes (Available to all, including Employees) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/" element={<ErrorBoundary module="Dashboard"><Dashboard /></ErrorBoundary>} />
                <Route path="/tasks" element={<ErrorBoundary module="Tasks"><TasksPage /></ErrorBoundary>} />
                <Route path="/projects" element={<ErrorBoundary module="Projects"><ProjectsPage /></ErrorBoundary>} />
                <Route path="/projects/:id" element={<ErrorBoundary module="Project Details"><ProjectDetailPage /></ErrorBoundary>} />
                <Route path="/profile" element={<ErrorBoundary module="Profile"><ProfilePage /></ErrorBoundary>} />
                <Route path="/notifications" element={<ErrorBoundary module="Notifications"><NotificationsPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* HR & Admin Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/crm" element={<ErrorBoundary module="CRM"><CRMPage /></ErrorBoundary>} />
                <Route path="/clients" element={<ErrorBoundary module="Clients"><ClientsPage /></ErrorBoundary>} />
                <Route path="/billing" element={<ErrorBoundary module="Billing"><BillingPage /></ErrorBoundary>} />
                <Route path="/billing/:id" element={<ErrorBoundary module="Invoice Details"><InvoiceDetail /></ErrorBoundary>} />
                <Route path="/support" element={<ErrorBoundary module="Support"><SupportDashboard /></ErrorBoundary>} />
                <Route path="/support/tickets/:id" element={<ErrorBoundary module="Ticket Details"><TicketDetailPage /></ErrorBoundary>} />
                <Route path="/hr" element={<ErrorBoundary module="HR"><HRDashboard /></ErrorBoundary>} />
                <Route path="/reports" element={<ErrorBoundary module="Reports"><ReportsPage /></ErrorBoundary>} />
                <Route path="/time-tracking" element={<ErrorBoundary module="Time Tracking"><TimeTrackingPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Admin Only Routes */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route element={<DashboardLayout children={<Outlet />} />}>
                <Route path="/teams" element={<ErrorBoundary module="Teams"><TeamPage /></ErrorBoundary>} />
                <Route path="/settings" element={<ErrorBoundary module="Settings"><SettingsPage /></ErrorBoundary>} />
              </Route>
            </Route>

            {/* Client Portal Routes */}
            <Route path="/portal" element={<ClientLayout />}>
              <Route index element={<ErrorBoundary module="Client Portal"><ClientDashboard /></ErrorBoundary>} />
              <Route path="projects" element={<ErrorBoundary module="Client Projects"><ClientProjects /></ErrorBoundary>} />
              <Route path="invoices" element={<ErrorBoundary module="Client Invoices"><ClientInvoices /></ErrorBoundary>} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster />
        </Router>
      </ErrorBoundary>
    </ThemeProvider>
  )
}

export default App
