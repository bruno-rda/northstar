import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PlugZap } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { Card } from '@/components/Card'
import { Skeleton } from '@/components/Skeleton'
import { formatDateTime } from '@/lib/formatters'
import { getIntegrationsOptions } from '@/api/@tanstack/react-query.gen'
import { ErrorState } from '@/components/ErrorState'
import { PROVIDER_LABELS } from '@/lib/labels'

export default function IntegrationsTab() {
  const { companyId } = useParams<{ companyId: string }>()

  const { data: integrations, isLoading, isError, error, refetch } = useQuery({
    ...getIntegrationsOptions({ path: { company_id: companyId ?? '' } }),
    enabled: Boolean(companyId),
  })

  if (isError) {
    return (
      <Card>
        <ErrorState title="Couldn't load integrations" error={error} onRetry={() => void refetch()} />
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-border last:border-0">
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-6 w-24" />
            </div>
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Integration Status</h2>
          <p className="text-sm text-text-muted mt-0.5">Read-only — connections are managed by the client inside their app.</p>
        </div>
      </div>

      {!integrations || integrations.length === 0 ? (
        <div className="text-center py-12 text-text-muted">
          <PlugZap size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium text-text-primary">No integrations connected</p>
          <p className="text-xs mt-1">The client connects integrations from within their own app.</p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {integrations.map((integration) => (
            <div key={integration.id} className="py-4 first:pt-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-text-primary">
                    {PROVIDER_LABELS[integration.provider]}
                  </span>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted mt-1">
                    <span>Connected {formatDateTime(integration.connected_at)}</span>
                    {integration.last_successful_sync_at && (
                      <span>Last sync {formatDateTime(integration.last_successful_sync_at)}</span>
                    )}
                  </div>
                </div>
                <Badge value={integration.status} />
              </div>
              {integration.status !== 'connected' && (
                <p className="mt-2 text-xs text-status-warning bg-status-warning-bg px-3 py-1.5 rounded-md inline-block">
                  {integration.status === 'needs_reauth'
                    ? 'Client needs to reauthorize this integration.'
                    : 'Integration is disconnected. Client needs to reconnect.'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
