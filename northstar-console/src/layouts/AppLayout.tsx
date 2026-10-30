import { useQueryClient } from '@tanstack/react-query'
import { Outlet, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { Building2, BarChart3, ChevronLeft, ChevronRight, Menu, X, LogOut } from 'lucide-react'
import { useUIStore } from '@/stores/uiStore'
import { useAuthStore } from '@/stores/authStore'
import { ProfileMenu } from '@/components/ProfileMenu'
import Toasts from '@/components/Toasts'

const NAV_ITEMS = [
  { label: 'Analytics', href: '/analytics', Icon: BarChart3 },
  { label: 'Companies', href: '/companies', Icon: Building2 },
]

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const toggle = useUIStore((s) => s.toggleSidebar)
  const { setCurrentStaff } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleSignOut = () => {
    // Drop the previous user's cached data before anyone else signs in on this tab.
    queryClient.clear()
    setCurrentStaff(null)
    void navigate('/login')
  }

  return (
    <aside
      className={`hidden lg:flex flex-col bg-surface-sidebar border-r border-border-sidebar shrink-0 transition-all duration-200 ${collapsed ? 'w-[72px]' : 'w-60'
        }`}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 border-b border-border-sidebar ${collapsed ? 'justify-center px-4' : 'px-5'}`}>
        {collapsed ? (
          <img src="/favicon-white.png" alt="NORTHSTAR" className="h-7 w-auto" />
        ) : (
          <img src="/logo-main-white.png" alt="NORTHSTAR" className="h-9 w-auto" />
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 flex flex-col gap-1 px-2" aria-label="Main navigation">
        {NAV_ITEMS.map(({ label, href, Icon }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                ? 'bg-white/10 text-text-inverse'
                : 'text-text-sidebar hover:bg-white/5 hover:text-text-inverse'
              }`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={18} className="shrink-0" aria-hidden />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: logout + collapse toggle */}
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
    </aside>
  )
}

function MobileHeader() {
  const { sidebarDrawerOpen, toggleSidebarDrawer } = useUIStore()
  return (
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
  )
}

function MobileDrawer() {
  const { sidebarDrawerOpen, setSidebarDrawerOpen } = useUIStore()
  const { setCurrentStaff } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  if (!sidebarDrawerOpen) return null

  const handleSignOut = () => {
    // Drop the previous user's cached data before anyone else signs in on this tab.
    queryClient.clear()
    setCurrentStaff(null)
    setSidebarDrawerOpen(false)
    void navigate('/login')
  }

  return (
    <>
      <div
        className="lg:hidden fixed inset-0 z-30 bg-black/40"
        onClick={() => setSidebarDrawerOpen(false)}
        aria-hidden
      />
      <aside className="lg:hidden fixed top-16 left-0 bottom-0 z-40 w-64 bg-surface-sidebar border-r border-border-sidebar flex flex-col">
        <nav className="flex-1 py-4 flex flex-col gap-1 px-2" aria-label="Main navigation">
          {NAV_ITEMS.map(({ label, href, Icon }) => (
            <NavLink
              key={href}
              to={href}
              onClick={() => setSidebarDrawerOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive
                  ? 'bg-white/10 text-text-inverse'
                  : 'text-text-sidebar hover:bg-white/5 hover:text-text-inverse'
                }`
              }
            >
              <Icon size={18} aria-hidden />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border-sidebar px-4 py-4">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 text-sm text-text-sidebar hover:text-text-inverse transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </aside>
    </>
  )
}

function ContentHeader() {
  const { currentStaff } = useAuthStore()
  return (
    <header className="flex items-center justify-end h-16 px-8 bg-surface-card border-b border-border shrink-0">
      {currentStaff && <ProfileMenu name={currentStaff.name} email={currentStaff.email} />}
    </header>
  )
}

export default function AppLayout() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const { pathname } = useLocation()

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <MobileHeader />
        <MobileDrawer />
        <ContentHeader />
        <main className="flex-1 overflow-y-auto bg-surface-base">
          <div className="px-8 py-8">
            <ErrorBoundary key={pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
      <Toasts />
    </div>
  )
}
