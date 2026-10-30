import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { STAFF } from '@/lib/staff'

export default function LoginPage() {
  const { setCurrentStaff } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/analytics'

  const handleSignIn = () => {
    // STAFF_STUB: sign in as the first seeded staff member. Replace with the real
    // Google Workspace SSO flow when it lands (identity from the SSO token).
    setCurrentStaff(STAFF[0] ?? null)
    void navigate(from, { replace: true })
  }

  return (
    <div className="w-full max-w-sm bg-surface-card rounded-lg shadow-xl p-8">
      <img src="/logo-main-black.png" alt="NORTHSTAR" className="h-8 w-auto mb-8" />
      <h1 className="text-xl font-semibold text-text-primary mb-1">NORTHSTAR Console</h1>
      <p className="text-sm text-text-muted mb-8">Sign in with your NORTHSTAR Google Workspace account.</p>
      <button
        onClick={handleSignIn}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-md text-sm font-medium text-text-primary bg-surface-card hover:bg-surface-base transition-colors"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
          <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" />
          <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" />
          <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.3z" />
        </svg>
        Sign in with Google
      </button>
      <p className="mt-4 text-xs text-text-muted text-center">
        Restricted to @gonorthstar.com accounts.
      </p>
    </div>
  )
}
