import { DollarSign, Percent, ShoppingCart, Target, TrendingUp, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { GetKpiSummaryData, KpiDefinition, KpiValue } from '@/api'

// Definitions (label, unit, direction, aggregation) are owned by northstar-api (D7). This file
// only adds presentation: an icon per key, and the display-level comparison of two values.

export type PlatformScope = NonNullable<GetKpiSummaryData['query']['platform_scope']>
export type KpiUnit = KpiDefinition['unit']

export const KPI_ICONS: Partial<Record<string, LucideIcon>> = {
  net_revenue: DollarSign,
  total_orders: ShoppingCart,
  gross_margin: Percent,
  roas: TrendingUp,
  cac: UserPlus,
  cvr: Target,
}

export type Movement = {
  delta: number | null // absolute change
  relPct: number | null // change relative to the previous value, in percent
  good: boolean | null // judged by the definition's direction: a falling CAC is good
}

export function movement(value: number | null, previous: number | null, definition: KpiDefinition | undefined): Movement {
  if (value === null || previous === null) return { delta: null, relPct: null, good: null }
  const delta = value - previous
  const relPct = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null
  const good = delta === 0 ? null : definition?.higher_is_better === false ? delta < 0 : delta > 0
  return { delta, relPct, good }
}

export function aggregatedValue(rows: KpiValue[] | undefined, kpiKey: string): number | null {
  return rows?.find((v) => v.kpi_key === kpiKey && v.platform_scope === 'aggregated' && v.status === 'ok')?.value ?? null
}
