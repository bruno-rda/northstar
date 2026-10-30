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

export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Money crosses the API as a string — the backend types it Decimal so no amount a client
// is charged on ever passes through a float64. Coerce here, at the display boundary.
export function formatCurrency(amount: number | string, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(amount))
}

export function formatPct(value: number | string): string {
  return `${Number(value)}%`
}

export function formatPeriodMonth(periodMonth: string): string {
  const [year, month] = periodMonth.split('-')
  return new Date(Number(year), Number(month) - 1).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  })
}
