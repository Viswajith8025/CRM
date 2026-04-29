import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/useAuthStore'
import { ThemeProvider } from '@/hooks/useTheme'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { PageWrapper } from '@/components/shared/PageWrapper'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

import Dashboard from '@/pages/Dashboard'
import LoginPage from '@/pages/LoginPage'

import CRMPage from '@/modules/crm/pages/CRMPage'
import ProjectsPage from '@/modules/projects/pages/ProjectsPage'
import ProjectDetailPage from '@/modules/projects/pages/ProjectDetailPage'
import TasksPage from '@/modules/tasks/pages/TasksPage'
import TimeTrackingPage from '@/modules/time-tracking/pages/TimeTrackingPage'
import BillingPage from '@/modules/billing/pages/BillingPage'
import InvoiceDetail from '@/modules/billing/pages/InvoiceDetail'
import { ClientLayout } from '@/modules/client-portal/layout/ClientLayout'
import ClientDashboard from '@/modules/client-portal/pages/ClientDashboard'
import ReportsPage from '@/modules/reports/pages/ReportsPage'
import SettingsPage from '@/modules/admin/pages/SettingsPage'

function App() {
  const { setSession, setUser } = useAuthStore()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <ThemeProvider defaultTheme="dark" storageKey="erp-theme">
      <Router>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout children={<Outlet />} />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/crm" element={<CRMPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/time-tracking" element={<TimeTrackingPage />} />
              <Route path="/billing" element={<BillingPage />} />
              <Route path="/billing/:id" element={<InvoiceDetail />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            {/* Client Portal Routes */}
            <Route path="/portal" element={<ClientLayout />}>
              <Route index element={<ClientDashboard />} />
              <Route path="projects" element={<PageWrapper title="My Projects">Client Projects View Coming Soon</PageWrapper>} />
              <Route path="invoices" element={<PageWrapper title="Invoices">Client Invoices View Coming Soon</PageWrapper>} />
            </Route>
          </Route>
          
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </Router>
    </ThemeProvider>
  )
}

// Simple layout wrapper for React Router
import { Outlet } from 'react-router-dom'

import { Toaster } from '@/components/ui/sonner'

export default App
