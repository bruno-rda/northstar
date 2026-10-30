import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import LoginPage from '@/pages/login/LoginPage'
import CompaniesPage from '@/pages/companies/CompaniesPage'
import CompanyDetailPage from '@/pages/companies/CompanyDetailPage'
import ProfileTab from '@/pages/companies/tabs/ProfileTab'
import ContextTab from '@/pages/companies/tabs/ContextTab'
import UsersTab from '@/pages/companies/tabs/UsersTab'
import IntegrationsTab from '@/pages/companies/tabs/IntegrationsTab'
import BillingTab from '@/pages/companies/tabs/BillingTab'
import ReportsTab from '@/pages/companies/tabs/ReportsTab'
import ReportDetailPage from '@/pages/companies/tabs/ReportDetailPage'
import AnalyticsPage from '@/pages/analytics/AnalyticsPage'

function RequireAuth() {
  const currentStaff = useAuthStore((s) => s.currentStaff)
  const location = useLocation()
  if (!currentStaff) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/analytics" replace />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/companies/:companyId" element={<CompanyDetailPage />}>
              <Route index element={<Navigate to="profile" replace />} />
              <Route path="profile" element={<ProfileTab />} />
              <Route path="context" element={<ContextTab />} />
              <Route path="users" element={<UsersTab />} />
              <Route path="integrations" element={<IntegrationsTab />} />
              <Route path="billing" element={<BillingTab />} />
              <Route path="reports" element={<ReportsTab />} />
              <Route path="reports/:reportId" element={<ReportDetailPage />} />
            </Route>
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
