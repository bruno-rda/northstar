import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ChevronRight, Download, FileText, Loader2 } from 'lucide-react'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useCanGenerateReport, useGenerateReport, useLatestReportAttempt, useReports } from '@/hooks/useReports'
import { useKpiDefinitions, usePeriodKpiValues } from '@/hooks/useKpis'
import { useToastStore } from '@/stores/toastStore'
import { aggregatedValue, movement } from '@/lib/kpiDefinitions'
import { formatDate } from '@/lib/formatters'
import { previousMonthStart } from '@/lib/periods'
import type { ReportSummary } from '@/api'
import { getErrorMessage } from '@/lib/errors'
import { ErrorState } from '@/components/ErrorState'
import { PERIOD_TYPE_LABELS } from '@/lib/labels'

// The client-facing failure message is deliberately generic and never surfaces
// report_attempt.failure_reason, which Part B marks technical/admin-only.
const GENERIC_FAILURE_MESSAGE =
  "Your last report couldn't be generated because a KPI couldn't be computed correctly — this has been logged and one of our team will follow up if needed."

function Movements({ report, companyId }: { report: ReportSummary; companyId: string }) {
  const { activeArea } = useCompanyContext()
  const { data: previousValues } = usePeriodKpiValues(companyId, activeArea, previousMonthStart(report.period_start))
  const { data: definitions } = useKpiDefinitions()

  const movements = report.kpi_snapshot
    .slice(0, 3)
    .map((snap) => {
      if (snap.value === null) return null
      const definition = definitions?.[snap.kpi_key]
      const { relPct, good } = movement(snap.value, aggregatedValue(previousValues, snap.kpi_key), definition)
      return { key: snap.kpi_key, label: definition?.label ?? snap.kpi_key, relPct, good }
    })
    .filter((m): m is { key: string; label: string; relPct: number | null; good: boolean | null } => m !== null)

  if (movements.length === 0) return null

  return (
    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap mt-1.5">
      {movements.map((m) => (
        <span key={m.key} className="text-xs text-text-muted">
          {m.label}
          {m.relPct !== null && (
            <span className={m.good === null ? 'text-text-muted' : m.good ? 'text-status-success' : 'text-status-critical'}>
              {' '}
              {m.relPct >= 0 ? '↑' : '↓'}
              {Math.abs(m.relPct).toFixed(1)}%
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

function ReportRow({ report, companyId }: { report: ReportSummary; companyId: string }) {
  const navigate = useNavigate()
  const addToast = useToastStore((s) => s.addToast)

  const goToDetail = () => navigate(`/companies/${companyId}/reports/${report.id}`)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={goToDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          void goToDetail()
        }
      }}
      className="flex items-start gap-4 px-5 py-5 border-b border-border last:border-b-0 hover:bg-surface-base transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary/50"
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-muted">
          {PERIOD_TYPE_LABELS[report.period_type]} · {formatDate(report.period_start)} – {formatDate(report.period_end)}
        </p>
        <p className="text-sm font-medium text-text-primary mt-1 leading-relaxed">{report.headline}</p>
        <Movements report={report} companyId={companyId} />
      </div>

      <div className="flex items-center gap-3 shrink-0 pt-0.5">
        <span className="hidden lg:inline text-xs text-text-muted">{formatDate(report.generated_at)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            addToast("PDF export isn't available in this preview.", 'info')
          }}
          className="flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text-primary hover:bg-surface-card transition-colors"
          aria-label="Download PDF"
          title="Download PDF"
        >
          <Download size={14} />
        </button>
        <ChevronRight size={16} className="text-text-muted shrink-0" aria-hidden />
      </div>
    </div>
  )
}

export default function ReportsPage() {
  const { companyId, activeArea, canCreateReport } = useCompanyContext()
  const addToast = useToastStore((s) => s.addToast)
  const [page, setPage] = useState(1)

  const { data, isLoading, isError, error, refetch } = useReports(companyId, activeArea, page)
  const { data: canGenerate, isError: eligibilityFailed } = useCanGenerateReport(companyId, activeArea)
  const { data: latestAttempt } = useLatestReportAttempt(companyId, activeArea)
  const generateMutation = useGenerateReport(companyId, activeArea)

  const isGenerating = latestAttempt?.outcome === 'in_progress'
  const showFailedNotice = latestAttempt?.outcome === 'failed'
  const eligible = canGenerate?.eligible ?? false
  const disabledReason = isGenerating
    ? 'A report is already being generated for this area.'
    : eligibilityFailed
      ? "Couldn't check whether a report can be generated. Refresh to try again."
      : !eligible
      ? canGenerate?.blocking_reason ?? undefined
      : undefined

  const handleGenerate = () => {
    generateMutation.mutate(undefined, {
      onError: (err) => {
        addToast(getErrorMessage(err, 'Could not start report generation.'), 'error')
      },
    })
  }

  const items = data?.items ?? []
  const isEmpty = !isLoading && items.length === 0 && !isGenerating

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Reports</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Past {activeArea === 'general' ? 'General' : 'Marketing'}-area reports, and the place to generate a new one.
          </p>
        </div>
        {canCreateReport && (
          <button
            onClick={handleGenerate}
            disabled={!!disabledReason || generateMutation.isPending}
            title={disabledReason}
            className="px-4 py-2 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Generate report
          </button>
        )}
      </div>

      {showFailedNotice && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-status-critical bg-status-critical-bg">
          <AlertCircle size={16} className="text-status-critical mt-0.5 shrink-0" aria-hidden />
          <p className="text-sm text-status-critical">{GENERIC_FAILURE_MESSAGE}</p>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : isError ? (
          <ErrorState title="Couldn't load your reports" error={error} onRetry={() => void refetch()} />
        ) : isEmpty ? (
          <EmptyState
            icon={FileText}
            title="No reports yet"
            description="Once your integrations are connected and the required KPIs are computing, you'll be able to generate your first report here."
          />
        ) : (
          <div>
            {isGenerating && (
              <div className="flex items-center gap-4 md:gap-6 px-5 py-4 border-b border-border">
                <div className="flex-1 flex items-center gap-2 text-text-muted">
                  <Loader2 size={14} className="animate-spin" aria-hidden />
                  <span className="text-sm">
                    Generating your {PERIOD_TYPE_LABELS[latestAttempt.period_type]} report…
                  </span>
                </div>
                <Badge value="in_progress" size="sm" />
              </div>
            )}
            {items.map((report) => (
              <ReportRow key={report.id} report={report} companyId={companyId} />
            ))}
          </div>
        )}
        {data && <Pagination page={page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />}
      </Card>
    </div>
  )
}
