import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Download, FileQuestion, Lock } from 'lucide-react'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useReport } from '@/hooks/useReports'
import { useKpiDefinitions, usePeriodKpiValues } from '@/hooks/useKpis'
import { useToastStore } from '@/stores/toastStore'
import { aggregatedValue, movement } from '@/lib/kpiDefinitions'
import { formatDate, formatKpiValue } from '@/lib/formatters'
import { previousMonthStart } from '@/lib/periods'
import type { Report, ReportSection } from '@/api'
import { ErrorState } from '@/components/ErrorState'
import { isNotFound } from '@/lib/errors'
import { PERIOD_TYPE_LABELS } from '@/lib/labels'

// Priority sections arrive as a markdown numbered list (`N. **Title** — description`).
// Parsed into discrete items so each priority can be its own spaced, legible unit
// instead of a compressed markdown <ol> inside a generic card.
function parsePriorityItems(markdown: string): { title: string; description: string }[] {
  return markdown
    .split(/\n?\d+\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((raw) => {
      const match = raw.match(/^\*\*(.+?)\*\*\s*[—-]?\s*(.*)$/s)
      return match ? { title: match[1] ?? raw, description: match[2] ?? '' } : { title: raw, description: '' }
    })
}

function KpiComparisonRow({ kpiKey, value, previousValue }: { kpiKey: string; value: number | null; previousValue: number | null }) {
  const { data: definitions } = useKpiDefinitions()
  const definition = definitions?.[kpiKey]
  const unit = definition?.unit ?? 'count'

  if (value === null) {
    return (
      <div className="flex items-center gap-2 py-3.5 border-b border-border last:border-b-0">
        <Lock size={14} className="text-text-muted shrink-0" aria-hidden />
        <p className="text-sm font-medium text-text-primary">{definition?.label ?? kpiKey}</p>
        <p className="text-xs text-text-muted">Not available for this period</p>
      </div>
    )
  }

  const { delta, good } = movement(value, previousValue, definition)

  return (
    <div className="flex items-center justify-between gap-3 py-3.5 border-b border-border last:border-b-0">
      <span className="text-sm font-medium text-text-primary">{definition?.label ?? kpiKey}</span>
      <div className="flex items-center gap-3 text-sm">
        <span className="font-semibold text-text-primary tabular-nums">{formatKpiValue(value, unit)}</span>
        {previousValue !== null && (
          <span className="text-xs text-text-muted tabular-nums">vs {formatKpiValue(previousValue, unit)} last period</span>
        )}
        {delta !== null && (
          <span className={`text-xs font-medium ${good === null ? 'text-text-muted' : good ? 'text-status-success' : 'text-status-critical'}`}>
            {delta >= 0 ? '↑' : '↓'}
            {formatKpiValue(Math.round(Math.abs(delta) * 100) / 100, unit)}
          </span>
        )}
      </div>
    </div>
  )
}

function KpiSnapshotSection({ report }: { report: Report }) {
  const { companyId } = useCompanyContext()
  const { data: previousValues } = usePeriodKpiValues(companyId, report.area, previousMonthStart(report.period_start))

  return (
    <Card id="kpi_snapshot">
      <h2 className="text-sm font-semibold text-text-primary mb-1">KPI Snapshot</h2>
      <p className="text-xs text-text-muted mb-2">
        The values this report was built from — a point-in-time snapshot, compared against the prior period.
      </p>
      <div>
        {report.kpi_snapshot.map((snap) => (
          <KpiComparisonRow
            key={snap.kpi_key}
            kpiKey={snap.kpi_key}
            value={snap.value}
            previousValue={aggregatedValue(previousValues, snap.kpi_key)}
          />
        ))}
      </div>
    </Card>
  )
}

function PrioritiesSection({ section }: { section: ReportSection }) {
  const items = parsePriorityItems(section.content)
  return (
    <section id={section.key}>
      <h2 className="text-base font-semibold text-text-primary mb-4">{section.title}</h2>
      <div className="space-y-5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-4 rounded-lg border border-border bg-surface-card p-5">
            <span className="text-2xl font-semibold text-text-muted tabular-nums shrink-0">{String(i + 1).padStart(2, '0')}</span>
            <div>
              <p className="text-sm font-semibold text-text-primary">{item.title}</p>
              {item.description && <p className="text-sm text-text-muted mt-1 leading-relaxed">{item.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function NarrativeSection({ section }: { section: ReportSection }) {
  return (
    <Card id={section.key}>
      <h2 className="text-base font-semibold text-text-primary mb-3">{section.title}</h2>
      <div className="markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
      </div>
    </Card>
  )
}

export default function ReportDetailPage() {
  const { companyId } = useCompanyContext()
  const { reportId } = useParams<{ reportId: string }>()
  const addToast = useToastStore((s) => s.addToast)
  const { data: report, isLoading, isError, error, refetch } = useReport(companyId, reportId)

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-[760px] mx-auto">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError && !isNotFound(error)) {
    return <ErrorState title="Couldn't load this report" error={error} onRetry={() => void refetch()} />
  }

  if (!report) {
    return (
      <EmptyState
        icon={FileQuestion}
        title="Report not found"
        description="This report may have been moved or no longer exists."
        action={
          <Link to={`/companies/${companyId}/reports`} className="text-sm font-medium text-accent-primary hover:underline">
            Back to Reports
          </Link>
        }
      />
    )
  }

  const briefSection = report.sections.find((s) => s.key.endsWith('_brief'))
  const prioritiesSection = report.sections.find((s) => s.key.includes('priorities'))
  const forecastSection = report.sections.find((s) => s.key === 'forecast')
  const otherSections = report.sections.filter(
    (s) => s !== briefSection && s !== prioritiesSection && s !== forecastSection,
  )

  const navItems = [
    briefSection && { key: briefSection.key, label: briefSection.title },
    prioritiesSection && { key: prioritiesSection.key, label: prioritiesSection.title },
    ...otherSections.map((s) => ({ key: s.key, label: s.title })),
    { key: 'kpi_snapshot', label: 'KPI Snapshot' },
    forecastSection && { key: forecastSection.key, label: forecastSection.title },
  ].filter((i): i is { key: string; label: string } => Boolean(i))

  return (
    <div className="max-w-[760px] mx-auto space-y-8">
      <Link
        to={`/companies/${companyId}/reports`}
        className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Reports
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">
            {PERIOD_TYPE_LABELS[report.period_type]} Report
          </h1>
          <p className="text-sm text-text-muted mt-1">
            {formatDate(report.period_start)} – {formatDate(report.period_end)} · Generated {formatDate(report.generated_at)}
          </p>
        </div>
        <button
          onClick={() => addToast("PDF export isn't available in this preview.", 'info')}
          className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium border border-border text-text-primary hover:bg-surface-base transition-colors"
        >
          <Download size={14} />
          Download PDF
        </button>
      </div>

      <nav className="flex items-center gap-x-4 gap-y-1 flex-wrap text-xs border-b border-border pb-4" aria-label="Report sections">
        {navItems.map((item) => (
          <a key={item.key} href={`#${item.key}`} className="text-text-muted hover:text-text-primary transition-colors">
            {item.label}
          </a>
        ))}
      </nav>

      {briefSection && (
        <div id={briefSection.key} className="markdown-body text-base leading-loose">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefSection.content}</ReactMarkdown>
        </div>
      )}

      {prioritiesSection && <PrioritiesSection section={prioritiesSection} />}

      {otherSections.map((section) => (
        <NarrativeSection key={section.key} section={section} />
      ))}

      <KpiSnapshotSection report={report} />

      {forecastSection && <NarrativeSection section={forecastSection} />}
    </div>
  )
}
