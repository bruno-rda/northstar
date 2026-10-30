import { useQuery } from '@tanstack/react-query'
import { getDailySalesOptions } from '@/api/@tanstack/react-query.gen'
import type { PlatformScope } from '@/lib/kpiDefinitions'
import { previousRange, type DateRange, type PeriodPreset } from '@/lib/periods'
import type { DailySalesPoint } from '@/api'

export type Granularity = 'daily' | 'weekly' | 'monthly'

export type TrendPoint = {
  index: number
  currentDate: string | null
  previousDate: string | null
  current: number | null
  previous: number | null
}

// Daily detail is only legible for short ranges; beyond ~1.5 months the line is bucketed
// coarser so it stays readable (weekly up to ~6 months, monthly beyond).
function granularityFor(range: DateRange): Granularity {
  const days =
    Math.round((new Date(`${range.end}T00:00:00Z`).getTime() - new Date(`${range.start}T00:00:00Z`).getTime()) / 86_400_000) + 1
  if (days <= 41) return 'daily'
  if (days <= 186) return 'weekly'
  return 'monthly'
}

type Bucket = { date: string; revenue: number }

function getISOWeekStart(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const dayOfWeek = d.getUTCDay()
  const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  d.setUTCDate(d.getUTCDate() - daysToMonday)
  return d.toISOString().slice(0, 10)
}

function bucketSeries(points: DailySalesPoint[], granularity: Granularity): Bucket[] {
  if (granularity === 'daily') return points.map((p) => ({ date: p.date, revenue: p.revenue }))
  if (granularity === 'weekly') {
    const byWeek = new Map<string, number>()
    for (const p of points) {
      const weekStart = getISOWeekStart(p.date)
      byWeek.set(weekStart, (byWeek.get(weekStart) ?? 0) + p.revenue)
    }
    return [...byWeek.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, revenue]) => ({ date, revenue }))
  }
  const byMonth = new Map<string, number>()
  for (const p of points) {
    const key = `${p.date.slice(0, 7)}-01`
    byMonth.set(key, (byMonth.get(key) ?? 0) + p.revenue)
  }
  return [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, revenue]) => ({ date, revenue }))
}

// Sales for the selected range vs the equivalent previous range, bucketed to a legible
// granularity and aligned by relative bucket index so the two lines overlay. If the
// previous range is incomplete, those buckets are simply absent.
export function useSalesTrend(companyId: string, range: DateRange, preset: PeriodPreset, platformScope: PlatformScope) {
  const prev = previousRange(range, preset)
  const granularity = granularityFor(range)

  const currentQuery = useQuery(
    getDailySalesOptions({
      path: { company_id: companyId },
      query: { period_start: range.start, period_end: range.end, platform_scope: platformScope },
    }),
  )
  const previousQuery = useQuery(
    getDailySalesOptions({
      path: { company_id: companyId },
      query: { period_start: prev.start, period_end: prev.end, platform_scope: platformScope },
    }),
  )

  const cur = bucketSeries(currentQuery.data ?? [], granularity)
  const prv = bucketSeries(previousQuery.data ?? [], granularity)
  const length = Math.max(cur.length, prv.length)
  const points: TrendPoint[] = Array.from({ length }, (_, i) => ({
    index: i,
    currentDate: cur[i]?.date ?? null,
    previousDate: prv[i]?.date ?? null,
    current: cur[i]?.revenue ?? null,
    previous: prv[i]?.revenue ?? null,
  }))

  return {
    points,
    granularity,
    currentRange: range,
    previousRange: prev,
    isLoading: currentQuery.isLoading || previousQuery.isLoading,
    isError: currentQuery.isError || previousQuery.isError,
  }
}
