import { useQueryClient } from '@tanstack/react-query'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import {
  LayoutDashboard,
  Plug,
  FileText,
  Bell,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  LogOut,
  PauseCircle,
} from 'lucide-react'
import { Permission } from '@/api'
import type { Area, MembershipWithCompany } from '@/api'
import { useMyMemberships } from '@/hooks/useMyMemberships'
import { useAlerts } from '@/hooks/useAlerts'
import { CompanyProvider } from '@/hooks/CompanyProvider'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'
import { Skeleton } from '@/components/Skeleton'
import { ProfileMenu } from '@/components/ProfileMenu'
import Toasts from '@/components/Toasts'
import { ErrorState } from '@/components/ErrorState'

const NAV_ITEMS = [
  { label: 'Dashboard', segment: 'dashboard', Icon: LayoutDashboard },
  { label: 'Integrations', segment: 'integrations', Icon: Plug },
  { label: 'Reports', segment: 'reports', Icon: FileText },
  { label: 'Alerts', segment: 'alerts', Icon: Bell },
]

function NavItems({ collapsed, drawer, onNavigate }: { collapsed: boolean; drawer?: boolean; onNavigate?: () => void }) {
  const { companyId, canManagePeople } = useCompanyContext()
  const items = canManagePeople ? [...NAV_ITEMS, { label: 'Team', segment: 'team', Icon: Users }] : NAV_ITEMS

  return (
    <nav className="flex-1 py-4 flex flex-col gap-1 px-2" aria-label="Main navigation">
      {items.map(({ label, segment, Icon }) => (
        <NavLink
          key={segment}
          to={`/companies/${companyId}/${segment}`}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive ? 'bg-white/10 text-text-inverse' : 'text-text-sidebar hover:bg-white/5 hover:text-text-inverse'
            }`
          }
          title={collapsed && !drawer ? label : undefined}
        >
          <Icon size={18} className="shrink-0" aria-hidden />
          {(!collapsed || drawer) && <span>{label}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const { setCurrentUser } = useAuthStore()
  const toggle = useUIStore((s) => s.toggleSidebar)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleSignOut = () => {
    // Drop the previous user's cached data before anyone else signs in on this tab.
    queryClient.clear()
    setCurrentUser(null)
    void navigate('/login')
  }

  return (
    <div className="border-t border-border-sidebar">
      <div className={`flex ${collapsed ? 'flex-col items-center' : 'items-center justify-between'} px-3 py-3 gap-2`}>
        <button
          onClick={handleSignOut}
          className="flex items-center justify-center w-8 h-8 rounded text-text-sidebar hover:bg-white/10 hover:text-text-inverse transition-colors"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut size={16} />
        </button>
        <button
          onClick={toggle}
          className="flex items-center justify-center w-8 h-8 rounded text-text-sidebar hover:bg-white/10 hover:text-text-inverse transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </div>
  )
}

function DesktopSidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  return (
    <aside
      className={`hidden lg:flex flex-col bg-surface-sidebar border-r border-border-sidebar shrink-0 transition-all duration-200 ${
        collapsed ? 'w-[72px]' : 'w-60'
      }`}
    >
      <div className={`flex items-center h-16 border-b border-border-sidebar ${collapsed ? 'justify-center px-4' : 'px-5'}`}>
        {collapsed ? (
          <img src="/favicon-white.png" alt="NORTHSTAR" className="h-7 w-auto" />
        ) : (
          <img src="/logo-main-white.png" alt="NORTHSTAR" className="h-9 w-auto" />
        )}
      </div>
      <NavItems collapsed={collapsed} />
      <SidebarFooter collapsed={collapsed} />
    </aside>
  )
}

function MobileNav() {
  const { sidebarDrawerOpen, toggleSidebarDrawer, setSidebarDrawerOpen } = useUIStore()
  return (
    <>
      <div className="lg:hidden flex items-center h-16 px-4 bg-surface-sidebar border-b border-border-sidebar">
        <button
          onClick={toggleSidebarDrawer}
          className="flex items-center justify-center w-8 h-8 text-text-inverse"
          aria-label="Toggle navigation"
        >
          {sidebarDrawerOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <img src="/logo-main-white.png" alt="NORTHSTAR" className="h-6 w-auto ml-3" />
      </div>
      {sidebarDrawerOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-30 bg-black/40"
            onClick={() => setSidebarDrawerOpen(false)}
            aria-hidden
          />
          <aside className="lg:hidden fixed top-16 left-0 bottom-0 z-40 w-64 bg-surface-sidebar border-r border-border-sidebar flex flex-col">
            <NavItems collapsed={false} drawer onNavigate={() => setSidebarDrawerOpen(false)} />
            <SidebarFooter collapsed={false} />
          </aside>
        </>
      )}
    </>
  )
}

function OrgSwitcher({ memberships, activeCompanyId }: { memberships: MembershipWithCompany[]; activeCompanyId: string }) {
  const navigate = useNavigate()
  const companyName = memberships.find((m) => m.company_id === activeCompanyId)?.company.name ?? ''

  if (memberships.length <= 1) {
    return <span className="text-base font-semibold text-text-primary truncate max-w-[220px]">{companyName}</span>
  }

  return (
    <div className="relative inline-flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-surface-base focus-within:ring-2 focus-within:ring-accent-primary/40 transition-colors">
      <span className="truncate max-w-[220px] text-base font-semibold text-text-primary">{companyName}</span>
      <ChevronDown size={15} className="shrink-0 text-text-muted" aria-hidden />
      <select
        value={activeCompanyId}
        onChange={(e) => navigate(`/companies/${e.target.value}/dashboard`)}
        aria-label="Switch organization"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      >
        {memberships.map((m) => (
          <option key={m.company_id} value={m.company_id}>
            {m.company.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function AreaToggle() {
  const { availableAreas, activeArea, setActiveArea } = useCompanyContext()
  if (availableAreas.length <= 1) return null

  const labels: Record<Area, string> = { general: 'General', marketing: 'Marketing' }

  return (
    <div className="inline-flex items-center rounded-full bg-surface-base border border-border p-0.5" role="tablist" aria-label="Active area">
      {availableAreas.map((area) => (
        <button
          key={area}
          role="tab"
          aria-selected={activeArea === area}
          onClick={() => setActiveArea(area)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            activeArea === area ? 'bg-text-primary text-text-inverse' : 'text-text-muted hover:text-text-primary'
          }`}
        >
          {labels[area]}
        </button>
      ))}
    </div>
  )
}

function NotificationBell({ companyId }: { companyId: string }) {
  const { data } = useAlerts(companyId, 'active', 1, 1)
  const hasActive = (data?.total ?? 0) > 0
  return (
    <NavLink
      to={`/companies/${companyId}/alerts`}
      className="relative flex items-center justify-center w-9 h-9 rounded-md text-text-muted hover:bg-surface-base transition-colors"
      aria-label="Alerts"
    >
      <Bell size={18} />
      {hasActive && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-status-critical" aria-hidden />}
    </NavLink>
  )
}

function Header({ memberships }: { memberships: MembershipWithCompany[] }) {
  const { companyId } = useCompanyContext()
  const { currentUser } = useAuthStore()

  return (
    <header className="flex items-center gap-4 h-16 px-6 lg:px-8 bg-surface-card border-b border-border shrink-0">
      <OrgSwitcher memberships={memberships} activeCompanyId={companyId} />
      <AreaToggle />
      <div className="flex-1" />
      <NotificationBell companyId={companyId} />
      {currentUser && <ProfileMenu name={currentUser.name} email={currentUser.email} />}
    </header>
  )
}

function FullPageLoading() {
  return (
    <div className="min-h-screen bg-surface-base p-8 space-y-4">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

function NotAMemberNotice() {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <h1 className="text-lg font-semibold text-text-primary mb-2">You don't have access to this company</h1>
        <p className="text-sm text-text-muted">
          If you believe this is a mistake, contact your NORTHSTAR representative to have your access reviewed.
        </p>
      </div>
    </div>
  )
}

function SuspendedNotice({ companyName }: { companyName: string }) {
  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-status-warning-bg mx-auto mb-4">
          <PauseCircle size={22} className="text-status-warning" aria-hidden />
        </div>
        <h1 className="text-lg font-semibold text-text-primary mb-2">Access temporarily paused</h1>
        <p className="text-sm text-text-muted">
          {companyName}'s account access is temporarily paused. Contact your NORTHSTAR representative for more information.
        </p>
      </div>
    </div>
  )
}

export default function AppLayout() {
  const { companyId } = useParams<{ companyId: string }>()
  const { pathname } = useLocation()
  const membershipsQuery = useMyMemberships()

  if (membershipsQuery.isLoading) return <FullPageLoading />
  if (membershipsQuery.isError) {
    return (
      <div className="min-h-screen bg-surface-base flex items-center justify-center p-6">
        <ErrorState title="Couldn't load your access" error={membershipsQuery.error} onRetry={() => void membershipsQuery.refetch()} />
      </div>
    )
  }
  if (!membershipsQuery.data) return <NotAMemberNotice />

  const membership = membershipsQuery.data.find((m) => m.company_id === companyId)
  if (!membership) return <NotAMemberNotice />
  if (membership.company.status === 'suspended') return <SuspendedNotice companyName={membership.company.name} />
  // Every page is area-scoped, so a membership without any view_* permission has nothing to show.
  if (!membership.permissions.some((p) => p === Permission.VIEW_GENERAL || p === Permission.VIEW_MARKETING)) {
    return <NotAMemberNotice />
  }

  return (
    <CompanyProvider membership={membership}>
      <div className="flex h-screen overflow-hidden">
        <DesktopSidebar />
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <MobileNav />
          <Header memberships={membershipsQuery.data} />
          <main className="flex-1 overflow-y-auto bg-surface-base">
            <div className="px-6 lg:px-8 py-8">
              <ErrorBoundary key={pathname}>
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </div>
        <Toasts />
      </div>
    </CompanyProvider>
  )
}
