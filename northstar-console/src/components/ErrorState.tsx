import { AlertTriangle } from 'lucide-react'
import { getErrorMessage } from '@/lib/errors'

type ErrorStateProps = {
  error?: unknown
  title?: string
  onRetry?: () => void
  compact?: boolean
}

export function ErrorState({ error, title = "Couldn't load this", onRetry, compact = false }: ErrorStateProps) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center text-center px-6 ${compact ? 'py-6' : 'py-16'}`}>
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-status-critical-bg mb-3">
        <AlertTriangle size={18} className="text-status-critical" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm mb-4">{getErrorMessage(error)}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 rounded-md border border-border text-sm font-medium text-text-primary hover:bg-surface-base transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  )
}
