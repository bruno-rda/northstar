// Month-based dashboard period presets. Presets anchor to the company's `data_as_of`
// (GET /calendar), never the browser clock: the last day with data is "today".

export type PeriodPreset = 'this_month' | 'last_month' | 'last_3_months' | 'last_12_months' | 'this_year' | 'custom'
export type DateRange = { start: string; end: string } // inclusive, 'YYYY-MM-DD'

export const PERIOD_PRESETS: { value: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'last_3_months', label: 'Last 3 months' },
  { value: 'last_12_months', label: 'Last 12 months' },
  { value: 'this_year', label: 'This year' },
]

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

function monthEnd(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

function addMonths(monthFirst: Date, n: number): Date {
  return new Date(Date.UTC(monthFirst.getUTCFullYear(), monthFirst.getUTCMonth() + n, 1))
}

// All presets but 'this_month' end at the last complete month
export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, asOf: string): DateRange {
  const today = new Date(`${asOf}T00:00:00Z`)
  const lastCompleteMonth = addMonths(monthStart(today), -1)
  const end = iso(monthEnd(lastCompleteMonth))
  switch (preset) {
    case 'this_month':
      return { start: iso(monthStart(today)), end: asOf }
    case 'last_month':
      return { start: iso(lastCompleteMonth), end }
    case 'last_3_months':
      return { start: iso(addMonths(lastCompleteMonth, -2)), end }
    case 'last_12_months':
      return { start: iso(addMonths(lastCompleteMonth, -11)), end }
    case 'this_year':
      return { start: iso(new Date(Date.UTC(lastCompleteMonth.getUTCFullYear(), 0, 1))), end }
  }
}

function isMonthAligned(range: DateRange): boolean {
  const start = new Date(`${range.start}T00:00:00Z`)
  const end = new Date(`${range.end}T00:00:00Z`)
  return start.getUTCDate() === 1 && iso(monthEnd(end)) === range.end
}

function monthSpan(range: DateRange): number {
  const s = new Date(`${range.start}T00:00:00Z`)
  const e = new Date(`${range.end}T00:00:00Z`)
  return (e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + 1
}

// Compare against the immediately preceding equivalent period.
// Whole-month ranges shift by months; arbitrary ranges shift by days.
// this_month compares against the entire previous month.
export function previousRange(range: DateRange, preset: PeriodPreset): DateRange {
  if (preset === 'this_month') {
    const prevMonth = addMonths(monthStart(new Date(`${range.start}T00:00:00Z`)), -1)
    return { start: iso(prevMonth), end: iso(monthEnd(prevMonth)) }
  }
  if (isMonthAligned(range)) {
    const n = monthSpan(range)
    const start = monthStart(new Date(`${range.start}T00:00:00Z`))
    return { start: iso(addMonths(start, -n)), end: iso(monthEnd(addMonths(start, -1))) }
  }
  const s = new Date(`${range.start}T00:00:00Z`)
  const e = new Date(`${range.end}T00:00:00Z`)
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1
  const prevEnd = new Date(s.getTime() - 86_400_000)
  const prevStart = new Date(prevEnd.getTime() - (days - 1) * 86_400_000)
  return { start: iso(prevStart), end: iso(prevEnd) }
}

// Human label for a range, e.g. "Jun 2026" or "Apr – Jun 2026".
export function formatRangeLabel(range: DateRange): string {
  const s = new Date(`${range.start}T00:00:00Z`)
  const e = new Date(`${range.end}T00:00:00Z`)
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' })
  const sameMonth = s.getUTCFullYear() === e.getUTCFullYear() && s.getUTCMonth() === e.getUTCMonth()
  if (sameMonth) return fmt(s, { month: 'short', year: 'numeric' })
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear()
  return `${fmt(s, { month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })} – ${fmt(e, {
    month: 'short',
    year: 'numeric',
  })}`
}

// Report periods are first-of-month ISO date strings (e.g. "2026-06-01").
export function previousMonthStart(periodStart: string): string {
  return iso(addMonths(monthStart(new Date(`${periodStart}T00:00:00Z`)), -1))
}
