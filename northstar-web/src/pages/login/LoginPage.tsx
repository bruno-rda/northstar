import { useState, type SubmitEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { signIn } from '@/lib/users'
import type { User } from '@/api'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage, getErrorStatus } from '@/lib/errors'

export default function LoginPage() {
  const { setCurrentUser } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [signedInUser, setSignedInUser] = useState<User | null>(null)

  const goToRequestAccess = () => navigate('/request-access', { state: { email } })

  const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      const user = signIn(email)
      setSignedInUser(user)
    } catch (err) {
      if (getErrorStatus(err) === 404) {
        setNotFound(true)
      } else {
        setError(getErrorMessage(err))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleContinue = () => {
    if (!signedInUser) return
    setCurrentUser(signedInUser)
    void navigate(from, { replace: true })
  }

  if (signedInUser) {
    return (
      <div className="w-full max-w-sm bg-surface-card rounded-lg shadow-xl p-8 text-center">
        <h1 className="text-xl font-semibold text-text-primary mb-1">Check your email</h1>
        <p className="text-sm text-text-muted mb-6">
          We sent a sign-in link to <span className="font-medium text-text-primary">{email}</span>. Click it to
          finish signing in.
        </p>
        <button
          onClick={handleContinue}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 transition-all"
        >
          <CheckCircle2 size={16} aria-hidden />
          Continue as {signedInUser.name}
        </button>
        <p className="mt-3 text-xs text-text-muted">(Preview mode — this stands in for clicking the emailed link.)</p>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="w-full max-w-sm bg-surface-card rounded-lg shadow-xl p-8 text-center">
        <h1 className="text-xl font-semibold text-text-primary mb-1">We couldn't find that account</h1>
        <p className="text-sm text-text-muted mb-6">
          No account is linked to <span className="font-medium text-text-primary">{email}</span>. Double-check
          the address, or request access to get started.
        </p>
        <button
          onClick={goToRequestAccess}
          className="w-full px-4 py-2.5 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 transition-all"
        >
          Request access →
        </button>
        <button
          onClick={() => setNotFound(false)}
          className="w-full mt-3 px-4 py-2.5 rounded-md text-sm font-medium border border-border text-text-primary hover:bg-surface-base transition-colors"
        >
          Try a different email
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm bg-surface-card rounded-lg shadow-xl p-8">
      <img src="/logo-main-black.png" alt="NORTHSTAR" className="h-8 w-auto mb-8" />
      <h1 className="text-xl font-semibold text-text-primary mb-1">Sign in to NORTHSTAR</h1>
      <p className="text-sm text-text-muted mb-8">Enter your email and we'll send you a sign-in link.</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-text-muted mb-1.5">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={`w-full px-3 py-2.5 rounded-md border text-sm text-text-primary bg-surface-card focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors ${
              error ? 'border-status-critical' : 'border-border'
            }`}
          />
          {error && <p className="mt-1.5 text-xs text-status-critical">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !email}
          className="w-full px-4 py-2.5 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isSubmitting ? 'Sending link…' : 'Send sign-in link'}
        </button>
      </form>
      <p className="mt-4 text-xs text-text-muted text-center">
        Don't have access yet?{' '}
        <button
          type="button"
          onClick={goToRequestAccess}
          className="font-medium text-status-info hover:underline"
        >
          Request access
        </button>
      </p>
    </div>
  )
}
