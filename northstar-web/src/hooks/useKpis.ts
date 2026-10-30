import { useQuery } from '@tanstack/react-query'
import { getKpiDefinitionsOptions, getKpiSummaryOptions, getKpiValuesOptions } from '@/api/@tanstack/react-query.gen'
import type { Area, KpiDefinition, KpiStatus } from '@/api'
import { previousRange, type DateRange, type PeriodPreset } from '@/lib/periods'
import type { PlatformScope } from '@/lib/kpiDefinitions'

const METRIC_KEYS_BY_AREA: Record<Area, string[]> = {
  general: ['net_revenue', 'total_orders', 'gross_margin'],
  marketing: ['roas', 'cac', 'cvr'],
}

export type SuccessMetricCard = {
  kpi_key: string
  value: number | null
  previous: number | null
  status: KpiStatus
}

export function useKpiDefinitions() {
  return useQuery({
    ...getKpiDefinitionsOptions(),
    staleTime: Infinity,
    select: (defs): Partial<Record<string, KpiDefinition>> => Object.fromEntries(defs.map((d) => [d.key, d])),
  })
}

// Dashboard success metrics over the selected range, against the equivalent previous range.
// northstar-api aggregates each window (sums for flow metrics, weighted ratios for rates); this
// hook only picks the two windows.
export function useSuccessMetrics(
  companyId: string,
  area: Area,
  range: DateRange,
  preset: PeriodPreset,
  platformScope: PlatformScope,
) {
  const prev = previousRange(range, preset)
  const summary = (r: DateRange) =>
    getKpiSummaryOptions({
      path: { company_id: companyId },
      query: { area, period_start: r.start, period_end: r.end, platform_scope: platformScope },
    })
  const current = useQuery(summary(range))
  const previous = useQuery(summary(prev))

  const cards: SuccessMetricCard[] = METRIC_KEYS_BY_AREA[area].map((key) => {
    const value = current.data?.find((v) => v.kpi_key === key)?.value ?? null
    const previousValue = previous.data?.find((v) => v.kpi_key === key)?.value ?? null
    return { kpi_key: key, value, previous: previousValue, status: value == null ? 'not_available' : 'ok' }
  })

  return {
    cards,
    isLoading: current.isLoading || previous.isLoading,
    isError: current.isError || previous.isError,
  }
}

// Every KPI value of one monthly period. Used to compare a report's snapshot against the
// prior period.
export function usePeriodKpiValues(companyId: string, area: Area, periodStart: string) {
  return useQuery(
    getKpiValuesOptions({
      path: { company_id: companyId },
      query: { area, period_type: 'monthly', period_start: periodStart },
    }),
  )
}
