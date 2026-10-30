import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, FileText, DollarSign, AlertTriangle } from 'lucide-react'
import { Card, CardHeader } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { Select } from '@/components/Select'
import { ProviderIcon } from '@/components/ProviderIcon'
import { formatCurrency } from '@/lib/formatters'
import { getUsageAnalyticsOptions } from '@/api/@tanstack/react-query.gen'
import { ErrorState } from '@/components/ErrorState'
import { PROVIDER_LABELS } from '@/lib/labels'

// ─── Date range presets ───────────────────────────────────────────────────────

type Preset = '30d' | '90d' | '12m' | 'this_year' | 'custom'

const PRESET_OPTIONS: { value: Preset; label: string }[] = [
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' },
  { value: 'this_year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
]

// Local calendar date; toISOString() would shift to UTC and skip ahead a day in the evening.
function isoDate(d: Date) {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function presetRange(preset: Exclude<Preset, 'custom'>) {
  const now = new Date()
  const from = new Date(now)
  if (preset === '30d') from.setDate(from.getDate() - 30)
  else if (preset === '90d') from.setDate(from.getDate() - 90)
  else if (preset === '12m') from.setFullYear(from.getFullYear() - 1)
  else if (preset === 'this_year') from.setMonth(0, 1)
  return { date_from: isoDate(from), date_to: isoDate(now) }
}

// ─── KPI card ─────────────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string
  value: string
  icon: React.ReactNode
  subtext?: string
}

function KpiCard({ label, value, icon, subtext }: KpiCardProps) {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">{label}</p>
          <p className="text-3xl font-semibold text-text-primary">{value}</p>
          {subtext && <p className="text-xs text-text-muted mt-1">{subtext}</p>}
        </div>
        <div className="p-2 bg-surface-base rounded-md text-text-muted">
          {icon}
        </div>
      </div>
    </Card>
  )
}

function KpiCardSkeleton() {
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-9 w-16" />
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    </Card>
  )
}

// ─── Analytics page ───────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [preset, setPreset] = useState<Preset>('12m')
  const defaultRange = presetRange('12m')
  const [customFrom, setCustomFrom] = useState(defaultRange.date_from)
  const [customTo, setCustomTo] = useState(defaultRange.date_to)

  const { date_from, date_to } =
    preset === 'custom' ? { date_from: customFrom, date_to: customTo } : presetRange(preset)

  const { data, isLoading, isError, error, refetch } = useQuery(getUsageAnalyticsOptions({ query: { date_from, date_to } }))

  const presetLabel = PRESET_OPTIONS.find((o) => o.value === preset)?.label ?? ''

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Usage Analytics</h1>
          <p className="text-sm text-text-muted mt-1">Cross-company overview — {presetLabel.toLowerCase()}</p>
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={preset}
            onChange={(e) => setPreset(e.target.value as Preset)}
            aria-label="Date range"
          >
            {PRESET_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>

          {preset === 'custom' && (
            <>
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                aria-label="From date"
                className="px-3 py-2 rounded-md border border-border text-sm bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
              />
              <span className="text-text-muted text-sm">–</span>
              <input
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                aria-label="To date"
                className="px-3 py-2 rounded-md border border-border text-sm bg-surface-card text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors"
              />
            </>
          )}
        </div>
      </div>

      {isError && (
        <Card className="mb-8">
          <ErrorState title="Couldn't load usage analytics" error={error} onRetry={() => void refetch()} compact />
        </Card>
      )}

      {/* ── KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {isLoading ? (
          [1, 2, 3].map((i) => <KpiCardSkeleton key={i} />)
        ) : data ? (
          <>
            <KpiCard
              label="Active companies"
              value={String(data.active_companies)}
              icon={<Building2 size={20} />}
              subtext="Currently active status"
            />
            <KpiCard
              label="Reports generated"
              value={String(data.reports_generated)}
              icon={<FileText size={20} />}
              subtext="Successful, this period"
            />
            <KpiCard
              label="Revenue reference"
              value={formatCurrency(data.total_revenue_reference)}
              icon={<DollarSign size={20} />}
              subtext="Aggregate across active billing records"
            />
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Integration health table */}
        <Card>
          <CardHeader title="Integration Health" />
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <Skeleton className="h-4 w-40" />
                  <div className="flex gap-3">
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-4 w-8" />
                  </div>
                </div>
              ))}
            </div>
          ) : data ? (
            <div>
              <div className="grid grid-cols-4 text-xs font-medium text-text-muted uppercase tracking-wide pb-2 border-b border-border mb-1">
                <span className="col-span-2">Provider</span>
                <span className="text-center">Connected</span>
                <span className="text-center">Issues</span>
              </div>
              <div className="divide-y divide-border">
                {data.integration_health_summary.map((summary) => {
                  const issues = summary.needs_reauth + summary.disconnected
                  return (
                    <div key={summary.provider} className="grid grid-cols-4 items-center py-3">
                      <span className="col-span-2 flex items-center gap-2 text-sm text-text-primary">
                        <ProviderIcon provider={summary.provider} size={24} />
                        {PROVIDER_LABELS[summary.provider]}
                      </span>
                      <span className="text-center">
                        {summary.connected > 0 ? (
                          <span className="text-sm font-medium text-status-success">{summary.connected}</span>
                        ) : (
                          <span className="text-sm text-text-muted">0</span>
                        )}
                      </span>
                      <span className="text-center">
                        {issues > 0 ? (
                          <span className="inline-flex items-center gap-1 text-sm font-medium text-status-warning">
                            <AlertTriangle size={12} />
                            {issues}
                          </span>
                        ) : (
                          <span className="text-sm text-text-muted">—</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
              {data.integration_health_summary.every((s) => s.needs_reauth === 0 && s.disconnected === 0) && (
                <p className="text-xs text-status-success mt-3 flex items-center gap-1">
                  <span>All integrations healthy</span>
                </p>
              )}
            </div>
          ) : null}
        </Card>

        {/* Most-used integrations */}
        <Card>
          <CardHeader title="Most-Used Integrations" />
          {isLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : data ? (
            <div className="flex flex-col gap-1">
              {data.most_used_integrations.map((item, i) => (
                <div key={item.provider} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted w-4">{i + 1}</span>
                    <div className="flex items-center gap-2">
                      <ProviderIcon provider={item.provider} size={24} />
                      <span className="text-sm text-text-primary">{PROVIDER_LABELS[item.provider]}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-surface-base rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent-primary rounded-full"
                        style={{ width: `${Math.round((item.count / (data.most_used_integrations[0]?.count || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-text-primary w-8 text-right">{item.count}</span>
                    <span className="text-xs text-text-muted">tenants</span>
                  </div>
                </div>
              ))}
              {data.most_used_integrations.every((i) => i.count === 0) && (
                <p className="text-sm text-text-muted text-center py-8">No integrations connected yet.</p>
              )}
            </div>
          ) : null}
        </Card>

      </div>
    </div>
  )
}
