import { useMemo, useState } from 'react'
import { PieChart, Pie, ResponsiveContainer, Tooltip } from 'recharts'
import { PieChart as PieIcon } from 'lucide-react'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { formatCurrency } from '@/lib/formatters'
import type { ProductContribution } from '@/api'

type Metric = 'sales' | 'orders'

function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const lig = l / 100
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const c = lig - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// A 12-stop graded palette sweeping magenta → purple → blue → teal → green, anchored on
// the brand's neon blue and lime. Colors are assigned by descending slice rank, so the
// gradient itself reads as "biggest to smallest". "Other" stays neutral, using text-muted from the design system.
const SLICE_PALETTE = Array.from({ length: 12 }, (_, i) => hslToHex(300 - (205 * i) / 11, 68, 56))
const OTHER_COLOR = '#71717a' // from design system: --color-text-muted
const MAX_SLICES = 11 // group anything beyond the 11th (plus <5%) into "Other"
const MIN_SHARE = 0.05

type Slice = { id: string; name: string; value: number; fill: string }

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
        active ? 'bg-surface-card text-text-primary shadow-sm' : 'text-text-muted hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  )
}

export function ProductPie({ data, isLoading, isError }: { data: ProductContribution[] | undefined; isLoading: boolean; isError: boolean }) {
  const [metric, setMetric] = useState<Metric>('sales')

  const calcPercentage = (value: number, total: number): string => {
    return total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
  }

  const { slices, total } = useMemo(() => {
    const rows = data ?? []
    const valued = rows
      .map((r) => ({ id: r.product_id, name: r.product_name, value: metric === 'sales' ? r.revenue : r.order_count }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value)
    const sum = valued.reduce((s, r) => s + r.value, 0)

    // Keep a product as its own slice only while it ranks in the top 11 AND holds at
    // least 5% share. Everything past that folds into a single "Other" wedge. Because
    // the list is sorted, the grouped tail is always contiguous.
    const built: Slice[] = []
    let otherValue = 0
    let otherCount = 0
    valued.forEach((r, i) => {
      const share = sum > 0 ? r.value / sum : 0
      if (i < MAX_SLICES && share >= MIN_SHARE) {
        built.push({ ...r, fill: SLICE_PALETTE[i] ?? OTHER_COLOR })
      } else {
        otherValue += r.value
        otherCount += 1
      }
    })
    if (otherCount > 0) {
      built.push({ id: '__other__', name: `Other (${otherCount})`, value: otherValue, fill: OTHER_COLOR })
    }
    return { slices: built, total: sum }
  }, [data, metric])

  const fmt = (v: number) => (metric === 'sales' ? formatCurrency(v) : new Intl.NumberFormat('en-US').format(v))

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Product mix</h3>
          <p className="text-xs text-text-muted mt-0.5">Which products drive the {metric === 'sales' ? 'revenue' : 'orders'}.</p>
        </div>
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-surface-base shrink-0">
          <ToggleButton active={metric === 'sales'} onClick={() => setMetric('sales')}>
            By sales
          </ToggleButton>
          <ToggleButton active={metric === 'orders'} onClick={() => setMetric('orders')}>
            By orders
          </ToggleButton>
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : isError ? (
        <EmptyState
          icon={PieIcon}
          title="Something went wrong"
          description="We couldn't load the product data. Try refreshing the page."
        />
      ) : slices.length === 0 ? (
        <EmptyState
          icon={PieIcon}
          title="No product data"
          description="Pick a period with sales, or connect a store, to see which products contribute most."
        />
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative w-[180px] h-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={80}
                  paddingAngle={1.5}
                  stroke="none"
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={false}
                />
                <Tooltip
                  cursor={false}
                  allowEscapeViewBox={{ x: true, y: true }}
                  offset={14}
                  wrapperStyle={{ zIndex: 10 }}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as Slice | undefined
                    if (!active || !p) return null
                    const pct = calcPercentage(p.value, total)
                    return (
                      <div className="rounded-md border border-border bg-surface-card px-3 py-2 shadow-sm">
                        <p className="text-xs font-medium text-text-primary">{p.name}</p>
                        <p className="text-xs text-text-muted tabular-nums">
                          {fmt(p.value)} · {pct}%
                        </p>
                      </div>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase tracking-wide text-text-muted">Total</span>
              <span className="text-sm font-semibold text-text-primary tabular-nums">{fmt(total)}</span>
            </div>
          </div>

          <ul className="flex-1 w-full space-y-1.5 min-w-0">
            {slices.map((s) => {
              const pct = calcPercentage(s.value, total)
              return (
                <li key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.fill }} aria-hidden />
                  <span className="flex-1 truncate text-text-primary">{s.name}</span>
                  <span className="tabular-nums text-text-muted">{pct}%</span>
                  <span className="w-16 text-right tabular-nums text-text-primary">{fmt(s.value)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}
