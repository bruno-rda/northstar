import type { KpiUnit } from '@/lib/kpiDefinitions'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

// A date-only string (`2026-06-01`) is a calendar date, not an instant: `new Date()` parses it
// as UTC midnight, which renders as the previous day west of UTC. Format it in UTC.
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(DATE_ONLY.test(isoString) && { timeZone: 'UTC' }),
  })
}

// Money crosses the API as a string (Decimal, D46). Coerce here, at the display boundary.
export function formatCurrency(amount: number | string, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

// Chart axis labels: $950, $1.2k, $48k.
export function formatCompactCurrency(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`
  return `$${Math.round(v)}`
}

export function formatPct(value: number | string): string {
  return `${Number(value)}%`
}

export function formatRatio(value: number): string {
  return `${value}x`
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function formatRelativeTime(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin} min ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hr ago`
  const diffDay = Math.round(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return formatDate(isoString)
}

export function formatKpiValue(value: number, unit: KpiUnit): string {
  switch (unit) {
    case 'currency':
      return formatCurrency(value)
    case 'percentage':
      return formatPct(value)
    case 'ratio':
      return formatRatio(value)
    case 'days':
      return `${value} days`
    case 'count':
    default:
      return new Intl.NumberFormat('en-US').format(value)
  }
}
