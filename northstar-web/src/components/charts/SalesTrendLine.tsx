import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { TrendingUp } from 'lucide-react'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { formatCurrency } from '@/lib/formatters'
import { formatRangeLabel, type DateRange } from '@/lib/periods'
import type { Granularity, TrendPoint } from '@/hooks/useSalesTrend'
import { formatCompactCurrency } from '@/lib/formatters'

const CURRENT_COLOR = 'var(--color-text-primary)'
const PREVIOUS_COLOR = 'var(--color-text-muted)'

function bucketLabel(iso: string | null, granularity: Granularity): string {
  if (!iso) return ''
  const d = new Date(`${iso}T00:00:00Z`)
  if (granularity === 'monthly') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

function tooltipTitle(iso: string | null, granularity: Granularity): string {
  const label = bucketLabel(iso, granularity)
  if (granularity === 'weekly') return `Week of ${label}`
  return label
}

export function SalesTrendLine({
  points,
  granularity,
  currentRange,
  previousRange,
  isLoading,
  isError,
}: {
  points: TrendPoint[]
  granularity: Granularity
  currentRange: DateRange
  previousRange: DateRange
  isLoading: boolean
  isError: boolean
}) {
  const hasData = points.some((p) => p.current != null || p.previous != null)

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Sales trend</h3>
          <p className="text-xs text-text-muted mt-0.5">Sales versus the previous period.</p>
        </div>
        <div className="flex flex-col gap-1 shrink-0 text-xs">
          <span className="flex items-center gap-1.5 text-text-primary">
            <span className="w-3.5 h-0.5 rounded-full" style={{ backgroundColor: CURRENT_COLOR }} aria-hidden />
            {formatRangeLabel(currentRange)}
          </span>
          <span className="flex items-center gap-1.5 text-text-muted">
            <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: PREVIOUS_COLOR }} aria-hidden />
            {formatRangeLabel(previousRange)}
          </span>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : isError ? (
        <EmptyState
          icon={TrendingUp}
          title="Something went wrong"
          description="We couldn't load the sales trend. Try refreshing the page."
        />
      ) : !hasData ? (
        <EmptyState
          icon={TrendingUp}
          title="No sales in this period"
          description="Pick a period with sales activity to see the trend and its comparison."
        />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" />
            <XAxis
              dataKey="index"
              tickFormatter={(i: number) => bucketLabel(points[i]?.currentDate ?? null, granularity)}
              tick={{ fontSize: 11, fill: '#71717a' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              minTickGap={granularity === 'daily' ? 32 : 20}
            />
            <YAxis
              tickFormatter={(v: number) => formatCompactCurrency(v)}
              tick={{ fontSize: 11, fill: '#71717a' }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-border)' }}
              content={({ active, payload }) => {
                const p = payload?.[0]?.payload as TrendPoint | undefined
                if (!active || !p) return null
                const delta = p.current != null && p.previous != null ? p.current - p.previous : null
                return (
                  <div className="rounded-md border border-border bg-surface-card px-3 py-2 shadow-sm space-y-1">
                    <p className="text-xs font-medium text-text-primary">{tooltipTitle(p.currentDate, granularity)}</p>
                    {p.current != null && (
                      <p className="text-xs tabular-nums text-text-primary">This: {formatCurrency(p.current)}</p>
                    )}
                    {p.previous != null && (
                      <p className="text-xs tabular-nums text-text-muted">
                        Prev ({bucketLabel(p.previousDate, granularity)}): {formatCurrency(p.previous)}
                      </p>
                    )}
                    {delta != null && (
                      <p className={`text-xs tabular-nums ${delta >= 0 ? 'text-status-success' : 'text-status-critical'}`}>
                        {delta >= 0 ? '+' : ''}
                        {formatCurrency(delta)} vs prev
                      </p>
                    )}
                  </div>
                )
              }}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke={PREVIOUS_COLOR}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="current"
              stroke={CURRENT_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  )
}
