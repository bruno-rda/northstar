import { Outlet, NavLink, useParams, Link, Navigate } from 'react-router-dom'
import { AlertCircle, ChevronRight } from 'lucide-react'
import { useCompany } from '@/hooks/useCompany'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { ErrorState } from '@/components/ErrorState'
import { isNotFound } from '@/lib/errors'

const TABS = [
  { label: 'Profile', path: 'profile' },
  { label: 'Strategic Context', path: 'context' },
  { label: 'Users', path: 'users' },
  { label: 'Integration Status', path: 'integrations' },
  { label: 'Billing', path: 'billing' },
  { label: 'Reports', path: 'reports' },
]

export default function CompanyDetailPage() {
  const { companyId } = useParams<{ companyId: string }>()
  const { data: company, isLoading, isError, error, refetch } = useCompany(companyId ?? '')

  if (!companyId) return <Navigate to="/companies" replace />

  if (isLoading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Skeleton className="h-4 w-20" />
          <ChevronRight size={14} className="text-text-muted" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <div className="flex gap-1 border-b border-border mb-6">
          {TABS.map((t) => (
            <Skeleton key={t.path} className="h-9 w-28 rounded-none" />
          ))}
        </div>
      </div>
    )
  }

  if (isError && !isNotFound(error)) {
    return <ErrorState title="Couldn't load this company" error={error} onRetry={() => void refetch()} />
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center gap-3 py-24">
        <AlertCircle size={32} className="text-status-critical" />
        <p className="text-sm text-text-muted">Company not found.</p>
        <Link to="/companies" className="text-sm font-medium text-text-primary hover:underline">
          Back to Companies
        </Link>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1.5 text-sm text-text-muted mb-5" aria-label="Breadcrumb">
        <Link to="/companies" className="hover:text-text-primary transition-colors">
          Companies
        </Link>
        <ChevronRight size={14} aria-hidden />
        <span className="text-text-primary font-medium">{company.name}</span>
      </nav>

      {/* Company header */}
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">{company.name}</h1>
        <Badge value={company.status} />
      </div>

      {/* Tab nav */}
      <div className="flex border-b border-border mb-6 overflow-x-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-accent-primary text-text-primary'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      {/* Tab content */}
      <Outlet />
    </div>
  )
}
