import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Clock, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { Pagination } from '@/components/Pagination'
import { formatDateTime } from '@/lib/formatters'
import { getReportAttemptsOptions } from '@/api/@tanstack/react-query.gen'
import type { ReportAttempt as Attempt } from '@/api'
import { ErrorState } from '@/components/ErrorState'
import { AREA_LABELS, PERIOD_LABELS } from '@/lib/labels'


function OutcomeIcon({ outcome }: { outcome: Attempt['outcome'] }) {
  if (outcome === 'succeeded') return <CheckCircle2 size={16} className="text-status-success shrink-0" />
  if (outcome === 'failed') return <XCircle size={16} className="text-status-critical shrink-0" />
  return <Clock size={16} className="text-status-warning shrink-0 animate-spin" />
}

function AttemptMeta({ attempt }: { attempt: Attempt }) {
  return (
    <div className="flex items-center gap-2 flex-wrap mb-1">
      <span className="text-sm font-medium text-text-primary">
        {AREA_LABELS[attempt.area]} · {PERIOD_LABELS[attempt.period_type]}
      </span>
      <span className="text-xs text-text-muted">{formatDateTime(attempt.triggered_at)}</span>
      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
        attempt.outcome === 'succeeded'
          ? 'bg-status-success-bg text-status-success'
          : attempt.outcome === 'failed'
            ? 'bg-status-critical-bg text-status-critical'
            : 'bg-status-warning-bg text-status-warning'
      }`}>
        {attempt.outcome}
      </span>
    </div>
  )
}

function AttemptRow({ attempt, companyId }: { attempt: Attempt; companyId: string }) {
  const [expanded, setExpanded] = useState(false)

  // A successful attempt produced a report — the whole row links to it so admins
  // can open the report and manage its action items.
  if (attempt.outcome === 'succeeded' && attempt.report_id) {
    return (
      <Link
        to={`/companies/${companyId}/reports/${attempt.report_id}`}
        className="flex items-center gap-3 py-4 first:pt-0 group"
      >
        <OutcomeIcon outcome={attempt.outcome} />
        <div className="flex-1 min-w-0">
          <AttemptMeta attempt={attempt} />
          <p className="text-xs text-text-muted">
            View report &amp; manage action items
          </p>
        </div>
        <ChevronRight size={16} className="text-text-muted group-hover:text-text-primary transition-colors" />
      </Link>
    )
  }

  return (
    <div className="py-4 first:pt-0">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <OutcomeIcon outcome={attempt.outcome} />
        </div>
        <div className="flex-1 min-w-0">
          <AttemptMeta attempt={attempt} />

          {attempt.outcome === 'failed' && attempt.failure_reason && (
            <>
              <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-center gap-1 text-xs text-status-critical hover:opacity-80 transition-opacity"
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Failure details
              </button>
              {expanded && (
                <div className="mt-2 bg-status-critical-bg border border-status-critical/20 rounded-md p-3">
                  {attempt.last_checkpoint && (
                    <p className="text-xs text-text-muted mb-1">
                      Stopped at: <code className="font-mono text-text-primary">{attempt.last_checkpoint}</code>
                    </p>
                  )}
                  <p className="text-xs text-status-critical leading-relaxed">{attempt.failure_reason}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReportsTab() {
  const { companyId } = useParams<{ companyId: string }>()
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data, isLoading, isError, error, refetch } = useQuery({
    ...getReportAttemptsOptions({ path: { company_id: companyId ?? '' }, query: { page, page_size: pageSize } }),
    enabled: Boolean(companyId),
  })

  if (!companyId) return null

  return (
    <Card>
      <div className="mb-5">
        <h2 className="text-base font-semibold text-text-primary">Reports</h2>
        <p className="text-sm text-text-muted mt-0.5">Every report generation — open a successful one to view it and manage its action items, or inspect failed attempts to diagnose "my report didn't show up" issues.</p>
      </div>

      {isLoading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 py-4 border-b border-border last:border-0">
              <Skeleton className="h-4 w-4 rounded-full mt-0.5" />
              <div className="flex-1">
                <Skeleton className="h-4 w-64 mb-2" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && <ErrorState title="Couldn't load report attempts" error={error} onRetry={() => void refetch()} />}

      {!isLoading && !isError && (!data || data.items.length === 0) && (
        <div className="text-center py-12 text-text-muted">
          <p className="text-sm">No report generation attempts yet for this company.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="divide-y divide-border">
            {data.items.map((attempt) => <AttemptRow key={attempt.id} attempt={attempt} companyId={companyId} />)}
          </div>
          {data.total > pageSize && (
            <div className="mt-6 pt-4 border-t border-border">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={data.total}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </Card>
  )
}
