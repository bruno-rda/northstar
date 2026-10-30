import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useAuthStore } from '@/stores/authStore'
import { useMyMemberships } from '@/hooks/useMyMemberships'
import { Skeleton } from '@/components/Skeleton'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import LoginPage from '@/pages/login/LoginPage'
import RequestAccessPage from '@/pages/request-access/RequestAccessPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import IntegrationsPage from '@/pages/integrations/IntegrationsPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import ReportDetailPage from '@/pages/reports/ReportDetailPage'
import AlertsPage from '@/pages/alerts/AlertsPage'
import TeamPage from '@/pages/team/TeamPage'
import { ErrorState } from '@/components/ErrorState'

// UX only — northstar-api enforces manage_people on every member write.
function RequireManagePeople({ children }: { children: ReactNode }) {
  const { canManagePeople } = useCompanyContext()
  return canManagePeople ? children : <Navigate to="../dashboard" replace />
}

function RequireAuth() {
  const currentUser = useAuthStore((s) => s.currentUser)
  const location = useLocation()
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}

// `/` redirects to the user's default company's dashboard (Part G routing conventions).
function RootRedirect() {
  const { data: memberships, isLoading, isError, error, refetch } = useMyMemberships()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface-base p-8">
        <Skeleton className="h-10 w-40" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
        <ErrorState title="Couldn't load your companies" error={error} onRetry={() => void refetch()} />
      </div>
    )
  }

  const defaultCompanyId = memberships?.[0]?.company_id
  if (!defaultCompanyId) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-text-primary mb-2">No company access yet</h1>
          <p className="text-sm text-text-muted">Contact your NORTHSTAR representative to have your access set up.</p>
        </div>
      </div>
    )
  }

  return <Navigate to={`/companies/${defaultCompanyId}/dashboard`} replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/request-access" element={<RequestAccessPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route index element={<RootRedirect />} />
          <Route path="/companies/:companyId" element={<AppLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="reports/:reportId" element={<ReportDetailPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="team" element={<RequireManagePeople><TeamPage /></RequireManagePeople>} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
