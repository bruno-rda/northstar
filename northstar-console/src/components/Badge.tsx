import {
  CheckCircle2,
  Circle,
  Clock,
  PauseCircle,
  XCircle,
  AlertTriangle,
  Unplug,
  AlertCircle,
  Info,
  AlertOctagon,
  Loader2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type BadgeConfig = {
  label: string
  textColor: string
  bgColor: string
  Icon: LucideIcon
  spin?: boolean
}

const BADGE_CONFIGS: Record<string, BadgeConfig> = {
  // CompanyStatus
  created: { label: 'Created', textColor: 'text-status-info', bgColor: 'bg-status-info-bg', Icon: Circle },
  onboarding: { label: 'Onboarding', textColor: 'text-status-info', bgColor: 'bg-status-info-bg', Icon: Clock },
  active: { label: 'Active', textColor: 'text-status-success', bgColor: 'bg-status-success-bg', Icon: CheckCircle2 },
  suspended: { label: 'Suspended', textColor: 'text-status-warning', bgColor: 'bg-status-warning-bg', Icon: PauseCircle },
  churned: { label: 'Churned', textColor: 'text-text-muted', bgColor: 'bg-accent-neutral', Icon: XCircle },

  // IntegrationStatus
  connected: { label: 'Connected', textColor: 'text-status-success', bgColor: 'bg-status-success-bg', Icon: CheckCircle2 },
  needs_reauth: { label: 'Needs Reauth', textColor: 'text-status-warning', bgColor: 'bg-status-warning-bg', Icon: AlertTriangle },
  disconnected: { label: 'Disconnected', textColor: 'text-status-critical', bgColor: 'bg-status-critical-bg', Icon: Unplug },
  error: { label: 'Error', textColor: 'text-status-critical', bgColor: 'bg-status-critical-bg', Icon: AlertCircle },

  // AlertSeverity
  info: { label: 'Info', textColor: 'text-status-info', bgColor: 'bg-status-info-bg', Icon: Info },
  warning: { label: 'Warning', textColor: 'text-status-warning', bgColor: 'bg-status-warning-bg', Icon: AlertTriangle },
  critical: { label: 'Critical', textColor: 'text-status-critical', bgColor: 'bg-status-critical-bg', Icon: AlertOctagon },

  // ReportAttempt.outcome
  in_progress: { label: 'In Progress', textColor: 'text-status-info', bgColor: 'bg-status-info-bg', Icon: Loader2, spin: true },
  succeeded: { label: 'Succeeded', textColor: 'text-status-success', bgColor: 'bg-status-success-bg', Icon: CheckCircle2 },
  failed: { label: 'Failed', textColor: 'text-status-critical', bgColor: 'bg-status-critical-bg', Icon: AlertCircle },

  // BillingRecord.status
  pending: { label: 'Pending', textColor: 'text-text-muted', bgColor: 'bg-accent-neutral', Icon: Clock },
  invoiced: { label: 'Invoiced', textColor: 'text-status-info', bgColor: 'bg-status-info-bg', Icon: Info },
  paid: { label: 'Paid', textColor: 'text-status-success', bgColor: 'bg-status-success-bg', Icon: CheckCircle2 },
}

type BadgeProps = {
  value: string
  size?: 'sm' | 'md'
}

export function Badge({ value, size = 'md' }: BadgeProps) {
  const config = BADGE_CONFIGS[value]
  if (!config) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-accent-neutral text-text-muted">
        {value}
      </span>
    )
  }

  const { label, textColor, bgColor, Icon, spin } = config
  const iconSize = size === 'sm' ? 11 : 13
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full text-xs font-medium whitespace-nowrap ${padding} ${textColor} ${bgColor}`}
    >
      <Icon size={iconSize} className={spin ? 'animate-spin' : ''} aria-hidden />
      {label}
    </span>
  )
}
