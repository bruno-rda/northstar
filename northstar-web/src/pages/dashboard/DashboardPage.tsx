import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  Circle,
  ClipboardList,
  Loader2,
  Lock,
  ShoppingCart,
  Sparkles,
} from 'lucide-react'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Select } from '@/components/Select'
import { PeriodFilter, type PeriodValue } from '@/components/PeriodFilter'
import { ProductPie } from '@/components/charts/ProductPie'
import { SalesTrendLine } from '@/components/charts/SalesTrendLine'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useActionItems, useUpdateActionItem } from '@/hooks/useActionItems'
import { useKpiDefinitions, useSuccessMetrics, type SuccessMetricCard } from '@/hooks/useKpis'
import { useProductContribution } from '@/hooks/useProductContribution'
import { useSalesTrend } from '@/hooks/useSalesTrend'
import { useCalendar } from '@/hooks/useCalendar'
import { useDashboardBriefing } from '@/hooks/useBriefing'
import { useReports } from '@/hooks/useReports'
import { useIntegrations } from '@/hooks/useIntegrations'
import { useAuthStore } from '@/stores/authStore'
import { KPI_ICONS, movement, type PlatformScope } from '@/lib/kpiDefinitions'
import { formatKpiValue } from '@/lib/formatters'
import { presetRange } from '@/lib/periods'
import { getProviderLabel } from '@/lib/integrationCatalog'
import type { ActionItem, ActionItemPriority, Area } from '@/api'
import { ErrorState } from '@/components/ErrorState'
import { useToastStore } from '@/stores/toastStore'
import { getErrorMessage } from '@/lib/errors'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// ─── Briefing header (clickable → latest report) ───────────────────────────────

function BriefingHeader({ companyId, companyName, area }: { companyId: string; companyName: string; area: Area }) {
  const currentUser = useAuthStore((s) => s.currentUser)
  const firstName = currentUser?.name.split(' ')[0]
  const { data, isLoading, isError } = useDashboardBriefing(companyId, area)
  const { data: reportsPage } = useReports(companyId, area, 1, 1)
  const latestReportId = reportsPage?.items[0]?.id

  const body = (
    <>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold text-text-primary">
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </h1>
        {data && (
          <span className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-full bg-surface-base border border-border text-xs font-medium text-text-muted whitespace-nowrap">
            <CalendarRange size={12} aria-hidden />
            {data.period_label}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="mt-2 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : isError ? (
        <p className="mt-1.5 text-sm text-status-critical">Couldn't load this period's briefing. Refresh to try again.</p>
      ) : (
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-text-primary/90">
          {data?.headline ??
            `Your first briefing will appear here once NORTHSTAR generates ${companyName}'s opening report.`}
        </p>
      )}
    </>
  )

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
      {latestReportId ? (
        <Link
          to={`/companies/${companyId}/reports/${latestReportId}`}
          className="block rounded-xl border border-border bg-surface-card p-6 hover:border-accent-primary/50 hover:shadow-md transition-all"
        >
          {body}
        </Link>
      ) : (
        <div className="rounded-xl border border-border bg-surface-card p-6">{body}</div>
      )}
    </motion.div>
  )
}

// ─── Success metric card ───────────────────────────────────────────────────────

function ComparisonBar({ label, pct, valueLabel, barClass }: { label: string; pct: number; valueLabel: string; barClass: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[62px] shrink-0 text-[10px] uppercase tracking-wide text-text-muted">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-base overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${barClass}`}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className="w-16 shrink-0 text-right text-[10px] tabular-nums text-text-muted">{valueLabel}</span>
    </div>
  )
}

function MetricCard({ card, index, isError }: { card: SuccessMetricCard; index: number; isError: boolean }) {
  const { data: definitions } = useKpiDefinitions()
  const definition = definitions?.[card.kpi_key]
  const Icon = KPI_ICONS[card.kpi_key] ?? Lock
  const unit = definition?.unit ?? 'count'
  const locked = isError || card.status !== 'ok' || card.value === null

  const currentValue = card.value
  const previousValue = card.previous
  const { delta, relPct, good } = movement(currentValue, previousValue, definition)
  const showRelPct = relPct !== null && (unit === 'currency' || unit === 'count')

  const deltaClass =
    good === null
      ? 'text-text-muted bg-accent-neutral'
      : good
        ? 'text-status-success bg-status-success-bg'
        : 'text-status-critical bg-status-critical-bg'

  const max = Math.max(currentValue ?? 0, previousValue ?? 0, 0.0001)
  const curPct = currentValue !== null ? Math.max((currentValue / max) * 100, 3) : 0
  const prevPct = previousValue !== null ? Math.max((previousValue / max) * 100, 3) : 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut', delay: index * 0.05 }}
    >
      <Card className="flex flex-col gap-4 h-full">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-md bg-surface-base text-text-muted shrink-0">
            <Icon size={14} aria-hidden />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {definition?.label ?? card.kpi_key}
          </span>
        </div>

        {locked ? (
          <div className="flex items-center gap-2 text-text-muted py-3">
            <Lock size={16} aria-hidden />
            <span className="text-sm">{isError ? 'Error loading data' : card.status === 'error' ? 'Needs a reconnected integration' : 'Not available yet'}</span>
          </div>
        ) : (
          <>
            <div className="flex items-end justify-between gap-2">
              <p className="text-[28px] font-semibold leading-none tracking-tight text-text-primary tabular-nums">
                {formatKpiValue(currentValue as number, unit)}
              </p>
              {delta !== null && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${deltaClass}`}>
                  {delta >= 0 ? <ArrowUp size={11} aria-hidden /> : <ArrowDown size={11} aria-hidden />}
                  {showRelPct && relPct !== null
                    ? `${relPct >= 0 ? '+' : ''}${relPct.toFixed(1)}%`
                    : formatKpiValue(Math.round(Math.abs(delta) * 100) / 100, unit)}
                </span>
              )}
            </div>

            <div className="space-y-1.5">
              <ComparisonBar label="This" pct={curPct} valueLabel={formatKpiValue(currentValue as number, unit)} barClass="bg-accent-primary" />
              {previousValue !== null && (
                <ComparisonBar label="Last" pct={prevPct} valueLabel={formatKpiValue(previousValue, unit)} barClass="bg-accent-neutral" />
              )}
            </div>
          </>
        )}
      </Card>
    </motion.div>
  )
}

// ─── Success metrics block (KPIs + charts, driven by the shared filters) ────────

// General-area only
function SuccessMetricsCharts({ companyId, period, platformScope }: { companyId: string; period: PeriodValue; platformScope: PlatformScope }) {
  const { data: products, isLoading: productsLoading, isError: productsError } = useProductContribution(companyId, period.range, platformScope)
  const trend = useSalesTrend(companyId, period.range, period.preset, platformScope)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
      <ProductPie data={products} isLoading={productsLoading} isError={productsError ?? false} />
      <SalesTrendLine
        points={trend.points}
        granularity={trend.granularity}
        currentRange={trend.currentRange}
        previousRange={trend.previousRange}
        isLoading={trend.isLoading}
        isError={trend.isError}
      />
    </div>
  )
}

function SuccessMetrics({
  companyId,
  area,
  period,
  onPeriodChange,
  asOf,
  platformScope,
  onPlatformChange,
  salesPlatforms,
}: {
  companyId: string
  area: Area
  period: PeriodValue
  onPeriodChange: (v: PeriodValue) => void
  asOf: string
  platformScope: PlatformScope
  onPlatformChange: (v: PlatformScope) => void
  salesPlatforms: PlatformScope[]
}) {
  const { cards, isLoading, isError } = useSuccessMetrics(companyId, area, period.range, period.preset, platformScope)

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-xl font-semibold text-text-primary">Success metrics</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <PeriodFilter value={period} onChange={onPeriodChange} asOf={asOf} />
          {area === 'general' && salesPlatforms.length > 0 && (
            <Select value={platformScope} onChange={(e) => onPlatformChange(salesPlatforms.find((p) => p === e.target.value) ?? 'aggregated')} className="py-1.5" aria-label="Platform">
              <option value="aggregated">All platforms</option>
              {salesPlatforms.map((p) => (
                <option key={p} value={p}>
                  {getProviderLabel(p)}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
          : cards.map((card, i) => <MetricCard key={card.kpi_key} card={card} index={i} isError={isError} />)}
      </div>

      {area === 'general' && <SuccessMetricsCharts companyId={companyId} period={period} platformScope={platformScope} />}
    </section>
  )
}

// ─── Action panels ─────────────────────────────────────────────────────────────

function Panel({ title, subtitle, icon, accent, children }: { title: string; subtitle: string; icon: ReactNode; accent?: boolean; children: ReactNode }) {
  return (
    <Card className={`flex flex-col ${accent ? 'border-accent-primary/40' : ''}`}>
      <div className="flex items-start gap-2.5 mb-4">
        <span className={`flex items-center justify-center w-8 h-8 rounded-md shrink-0 ${accent ? 'bg-accent-primary/15 text-text-primary' : 'bg-surface-base text-text-muted'}`}>
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
        </div>
      </div>
      {children}
    </Card>
  )
}

const NORTHSTAR_STATUS: Record<ActionItem['status'], { label: string; pct: number; Icon: typeof Circle; iconClass: string; barClass: string; spin?: boolean }> = {
  pending: { label: 'Not started', pct: 6, Icon: Circle, iconClass: 'text-text-muted', barClass: 'bg-accent-neutral' },
  in_progress: { label: 'In progress', pct: 55, Icon: Loader2, iconClass: 'text-text-primary', barClass: 'bg-accent-primary', spin: true },
  done: { label: 'Done', pct: 100, Icon: CheckCircle2, iconClass: 'text-status-success', barClass: 'bg-status-success' },
}

function NorthstarActionRow({ item }: { item: ActionItem }) {
  const meta = NORTHSTAR_STATUS[item.status]
  return (
    <li className="flex items-start gap-3 py-3.5 border-b border-border last:border-b-0">
      <meta.Icon size={16} className={`mt-0.5 shrink-0 ${meta.iconClass} ${meta.spin ? 'animate-spin' : ''}`} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${item.status === 'done' ? 'text-text-muted' : 'text-text-primary'}`}>{item.title}</p>
        <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
        <div className="flex items-center gap-2.5 mt-2">
          <div className="flex-1 h-1.5 max-w-[160px] rounded-full bg-surface-base overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${meta.barClass}`}
              initial={{ width: 0 }}
              animate={{ width: `${meta.pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[11px] font-medium text-text-muted">{meta.label}</span>
        </div>
      </div>
    </li>
  )
}

// Priority is conveyed with a small dot + short label — deliberately understated so it
// signals order without shouting urgency.
const PRIORITY_META: Record<ActionItemPriority, { label: string; dotClass: string; textClass: string }> = {
  high: { label: 'High', dotClass: 'bg-status-warning', textClass: 'text-text-primary' },
  medium: { label: 'Medium', dotClass: 'bg-text-muted', textClass: 'text-text-muted' },
  low: { label: 'Low', dotClass: 'bg-accent-neutral', textClass: 'text-text-muted' },
}
const PRIORITY_RANK: Record<ActionItemPriority, number> = { high: 0, medium: 1, low: 2 }

function ClientActionRow({ item, companyId, area }: { item: ActionItem; companyId: string; area: Area }) {
  const updateItem = useUpdateActionItem(companyId, area)
  const addToast = useToastStore((s) => s.addToast)
  const done = item.status === 'done'
  const priority = PRIORITY_META[item.priority]

  return (
    <li className="flex items-start gap-3 py-3.5 border-b border-border last:border-b-0">
      <input
        type="checkbox"
        checked={done}
        onChange={(e) =>
          updateItem.mutate(
            { actionItemId: item.id, status: e.target.checked ? 'done' : 'pending' },
            { onError: (err) => addToast(getErrorMessage(err, "Couldn't update this action"), 'error') },
          )
        }
        className="mt-0.5 w-4 h-4 accent-accent-primary shrink-0 cursor-pointer"
        aria-label={`Mark "${item.title}" as ${done ? 'not done' : 'done'}`}
      />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${done ? 'text-text-muted line-through' : 'text-text-primary'}`}>{item.title}</p>
        <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
      </div>
      {!done && (
        <span className={`shrink-0 flex items-center gap-1.5 text-[11px] font-medium ${priority.textClass}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${priority.dotClass}`} aria-hidden />
          {priority.label}
        </span>
      )}
    </li>
  )
}

function ActionPanels({ companyId, area }: { companyId: string; area: Area }) {
  const { data: items, isLoading, isError, error, refetch } = useActionItems(companyId, area)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <Card>
        <ErrorState title="Couldn't load your priorities" error={error} onRetry={() => void refetch()} compact />
      </Card>
    )
  }

  if (!items || items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="No recommendations yet"
          description="Once your first report is generated, your priorities will appear here, split into what NORTHSTAR executes for you and what needs your attention."
        />
      </Card>
    )
  }

  const northstarItems = items.filter((i) => i.owner === 'northstar')
  const clientItems = items
    .filter((i) => i.owner === 'client')
    .sort(
      (a, b) =>
        Number(a.status === 'done') - Number(b.status === 'done') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
    )

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      <Panel
        title="What NORTHSTAR is doing for you"
        subtitle="Work our team is executing on your behalf."
        icon={<Sparkles size={16} className="text-accent-primary" aria-hidden />}
        accent
      >
        {northstarItems.length === 0 ? (
          <p className="text-sm text-text-muted py-2">Nothing in flight right now.</p>
        ) : (
          <ul>
            {northstarItems.map((item) => (
              <NorthstarActionRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="What needs you"
        subtitle="Ordered by priority. Please tackle these as soon as you can."
        icon={<ClipboardList size={16} aria-hidden />}
      >
        {clientItems.length === 0 ? (
          <p className="text-sm text-text-muted py-2">You're all caught up.</p>
        ) : (
          <>
            <ul>
              {clientItems.map((item) => (
                <ClientActionRow key={item.id} item={item} companyId={companyId} area={area} />
              ))}
            </ul>
            <p className="text-xs text-text-muted mt-4 pt-3 border-t border-border">
              Not sure about any of these, yours or ours? Reach out and we will walk you through it.
            </p>
          </>
        )}
      </Panel>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { companyId } = useCompanyContext()
  const calendar = useCalendar(companyId)

  if (calendar.isLoading) return <Skeleton className="h-40 w-full" />
  if (!calendar.data) {
    return <ErrorState title="Couldn't load the dashboard" error={calendar.error} onRetry={() => void calendar.refetch()} />
  }
  return <Dashboard asOf={calendar.data.data_as_of} />
}

function Dashboard({ asOf }: { asOf: string }) {
  const { companyId, activeArea, membership } = useCompanyContext()
  const { data: briefing } = useDashboardBriefing(companyId, activeArea)
  const { data: integrations } = useIntegrations(companyId)

  const [period, setPeriod] = useState<PeriodValue>(() => ({ preset: 'last_month', range: presetRange('last_month', asOf) }))
  const [platformScope, setPlatformScope] = useState<PlatformScope>('aggregated')

  const salesPlatforms: PlatformScope[] = (integrations ?? []).flatMap((i) =>
    i.status === 'connected' && (i.provider === 'amazon' || i.provider === 'tiendanube') ? [i.provider] : [],
  )

  return (
    <div className="space-y-6">
      <BriefingHeader companyId={companyId} companyName={membership.company.name} area={activeArea} />

      {briefing?.posture === 'onboarding' && (
        <Link
          to={`/companies/${companyId}/integrations`}
          className="group flex items-start gap-3 px-4 py-3 rounded-lg border border-status-info bg-status-info-bg"
        >
          <ShoppingCart size={16} className="text-status-info mt-0.5 shrink-0" aria-hidden />
          <p className="text-sm text-status-info">
            Connect Amazon or Tiendanube to bring this dashboard to life — your KPIs and first report unlock from there.
          </p>
          <ArrowRight size={15} className="text-status-info ml-auto mt-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform" aria-hidden />
        </Link>
      )}

      <ActionPanels companyId={companyId} area={activeArea} />

      <SuccessMetrics
        companyId={companyId}
        area={activeArea}
        period={period}
        onPeriodChange={setPeriod}
        asOf={asOf}
        platformScope={platformScope}
        onPlatformChange={setPlatformScope}
        salesPlatforms={salesPlatforms}
      />
    </div>
  )
}
