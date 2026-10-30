import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { useToastStore } from '@/stores/toastStore'
import type { ToastType } from '@/stores/toastStore'

const TOAST_STYLES: Record<ToastType, { bg: string; text: string; icon: typeof CheckCircle2 }> = {
  success: { bg: 'bg-status-success-bg border-status-success', text: 'text-status-success', icon: CheckCircle2 },
  error: { bg: 'bg-status-critical-bg border-status-critical', text: 'text-status-critical', icon: AlertCircle },
  info: { bg: 'bg-status-info-bg border-status-info', text: 'text-status-info', icon: Info },
}

export default function Toasts() {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80" role="region" aria-label="Notifications">
      {toasts.map((toast) => {
        const { bg, text, icon: Icon } = TOAST_STYLES[toast.type]
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-md ${bg}`}
            role="alert"
          >
            <Icon size={16} className={`mt-0.5 shrink-0 ${text}`} aria-hidden />
            <p className={`flex-1 text-sm font-medium ${text}`}>{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className={`shrink-0 ${text} opacity-70 hover:opacity-100 transition-opacity`}
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
