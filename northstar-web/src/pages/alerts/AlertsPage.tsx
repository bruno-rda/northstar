import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, CheckCircle2, Settings } from 'lucide-react'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { EmptyState } from '@/components/EmptyState'
import { Pagination } from '@/components/Pagination'
import { Switch } from '@/components/Switch'
import { Modal } from '@/components/Modal'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useAlerts, useDismissAlert, useNotificationPreferences, useUpdateNotificationPreference } from '@/hooks/useAlerts'
import { formatDate, formatTime } from '@/lib/formatters'
import { AlertType } from '@/api'
import type { Alert, AlertSeverity } from '@/api'
import { ErrorState } from '@/components/ErrorState'
import { getErrorMessage } from '@/lib/errors'
import { useToastStore } from '@/stores/toastStore'

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  integration_disconnected: 'Integration disconnected',
  token_expiring: 'Token expiring',
  report_available: 'Report available',
  report_generation_failed: 'Report generation failed',
}

// Severity is carried by the type label's color alone — most alerts are informational
// and stay neutral; only warning/critical earn emphasis, so emphasis stays meaningful.
const SEVERITY_TEXT: Record<AlertSeverity, string> = {
  info: 'text-text-primary',
  warning: 'text-status-warning',
  critical: 'text-status-critical',
}

const ALL_ALERT_TYPES = Object.values(AlertType)

function groupByDate(alerts: Alert[]): { key: string; label: string; items: Alert[] }[] {
  const groups: { key: string; label: string; items: Alert[] }[] = []
  for (const alert of alerts) {
    const key = alert.created_at.slice(0, 10)
    const group = groups.find((g) => g.key === key)
    if (group) {
      group.items.push(alert)
    } else {
      groups.push({ key, label: formatDate(alert.created_at), items: [alert] })
    }
  }
  return groups
}

function AlertRow({ alert, companyId, showDismiss }: { alert: Alert; companyId: string; showDismiss: boolean }) {
  const dismissMutation = useDismissAlert(companyId)
  const addToast = useToastStore((s) => s.addToast)
  const linkTo = alert.related_report_id
    ? `/companies/${companyId}/reports/${alert.related_report_id}`
    : alert.related_integration_id
      ? `/companies/${companyId}/integrations`
      : null

  return (
    <li className="flex items-start justify-between gap-6 px-5 py-4 border-b border-border last:border-b-0">
      <div className="min-w-0">
        <p className={`text-sm font-medium ${SEVERITY_TEXT[alert.severity]}`}>{ALERT_TYPE_LABELS[alert.type]}</p>
        <p className="text-sm text-text-muted mt-1">{alert.message}</p>
        {linkTo && (
          <Link to={linkTo} className="inline-block mt-2 text-xs font-medium text-accent-primary hover:underline">
            View →
          </Link>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-5">
        <span className="text-xs text-text-muted tabular-nums">{formatTime(alert.created_at)}</span>
        {showDismiss && (
          <button
            onClick={() =>
              dismissMutation.mutate(alert.id, {
                onError: (err) => addToast(getErrorMessage(err, "Couldn't dismiss this alert"), 'error'),
              })
            }
            disabled={dismissMutation.isPending}
            className="text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </li>
  )
}

function NotificationPreferences() {
  const { data: prefs, isLoading, isError, error, refetch } = useNotificationPreferences()
  const updateMutation = useUpdateNotificationPreference()
  const addToast = useToastStore((s) => s.addToast)
  const update = (vars: Parameters<typeof updateMutation.mutate>[0]) =>
    updateMutation.mutate(vars, {
      onError: (err) => addToast(getErrorMessage(err, "Couldn't save your notification settings"), 'error'),
    })

  return (
    <div>
      <p className="text-xs text-text-muted mb-5">Choose what you're told about, and where.</p>

      {isLoading ? (
        <div className="space-y-3">
          {ALL_ALERT_TYPES.map((t) => (
            <Skeleton key={t} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title="Couldn't load your notification settings" error={error} onRetry={() => void refetch()} compact />
      ) : (
        <div className="grid grid-cols-[1fr_56px_56px] gap-y-1">
          <span />
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted text-center pb-2">In-app</span>
          <span className="text-[11px] font-medium uppercase tracking-wide text-text-muted text-center pb-2">Email</span>
          {ALL_ALERT_TYPES.map((type) => {
            const pref = prefs?.find((p) => p.alert_type === type)
            const inAppEnabled = pref?.in_app_enabled ?? true
            const emailEnabled = pref?.email_enabled ?? true
            return (
              <Fragment key={type}>
                <span className="text-sm text-text-primary py-3 border-t border-border">{ALERT_TYPE_LABELS[type]}</span>
                <div className="flex items-center justify-center py-3 border-t border-border">
                  <Switch
                    checked={inAppEnabled}
                    ariaLabel={`In-app notifications for ${ALERT_TYPE_LABELS[type]}`}
                    disabled={updateMutation.isPending}
                    onChange={(next) => update({ alertType: type, inAppEnabled: next, emailEnabled })}
                  />
                </div>
                <div className="flex items-center justify-center py-3 border-t border-border">
                  <Switch
                    checked={emailEnabled}
                    ariaLabel={`Email notifications for ${ALERT_TYPE_LABELS[type]}`}
                    disabled={updateMutation.isPending}
                    onChange={(next) => update({ alertType: type, inAppEnabled, emailEnabled: next })}
                  />
                </div>
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function AlertsPage() {
  const { companyId } = useCompanyContext()
  const [tab, setTab] = useState<'active' | 'dismissed'>('active')
  const [page, setPage] = useState(1)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { data, isLoading, isError, error, refetch } = useAlerts(companyId, tab, page)

  const items = data?.items ?? []
  const groups = groupByDate(items)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Alerts</h1>
          <p className="text-sm text-text-muted mt-0.5">Everything the notification system has raised, in one place.</p>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="shrink-0 flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
        >
          <Settings size={14} aria-hidden />
          Notification settings
        </button>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="flex border-b border-border">
          {(['active', 'dismissed'] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t)
                setPage(1)
              }}
              className={`px-5 py-3.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? 'text-text-primary border-b-2 border-accent-primary -mb-px' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        {isLoading ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <ErrorState title="Couldn't load your alerts" error={error} onRetry={() => void refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={tab === 'active' ? CheckCircle2 : Bell}
            title={tab === 'active' ? "You're all caught up" : 'No dismissed alerts'}
            description={
              tab === 'active'
                ? 'New alerts will show up here as they happen — integration issues, expiring tokens, and reports.'
                : 'Alerts you dismiss will appear here.'
            }
          />
        ) : (
          <div>
            {groups.map((group) => (
              <div key={group.key}>
                <p className="px-5 pt-4 pb-2 text-xs font-medium uppercase tracking-wide text-text-muted">{group.label}</p>
                <ul>
                  {group.items.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} companyId={companyId} showDismiss={tab === 'active'} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {data && <Pagination page={page} pageSize={data.page_size} total={data.total} onPageChange={setPage} />}
      </Card>

      <Modal open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Notification settings">
        <NotificationPreferences />
      </Modal>
    </div>
  )
}
