import { useState, type ReactNode } from 'react'
import { Info, ShoppingCart } from 'lucide-react'
import { Card } from '@/components/Card'
import { Badge } from '@/components/Badge'
import { Skeleton } from '@/components/Skeleton'
import { Modal } from '@/components/Modal'
import { ProviderIcon } from '@/components/ProviderIcon'
import { useCompanyContext } from '@/hooks/useCompanyContext'
import { useConnectIntegration, useDisconnectIntegration, useIntegrations } from '@/hooks/useIntegrations'
import { useCompanyMembers } from '@/hooks/useTeam'
import { useToastStore } from '@/stores/toastStore'
import { formatDate, formatRelativeTime } from '@/lib/formatters'
import { INTEGRATION_CATALOG, INTEGRATION_CATEGORIES, getProviderLabel } from '@/lib/integrationCatalog'
import type { FutureProvider } from '@/lib/integrationCatalog'
import type { IntegrationConnection, Provider } from '@/api'
import { ErrorState } from '@/components/ErrorState'

const ECOMMERCE_PROVIDERS: Provider[] = ['amazon', 'tiendanube']

function IntegrationCard({
  provider,
  integration,
  canManage,
  connectedByName,
  isConnecting,
  isDisconnecting,
  onConnect,
  onDisconnect,
}: {
  provider: Provider
  integration: IntegrationConnection | undefined
  canManage: boolean
  connectedByName: string | null
  isConnecting: boolean
  isDisconnecting: boolean
  onConnect: () => void
  onDisconnect: () => void
}) {
  const status = integration?.status ?? 'disconnected'
  const isBroken = status === 'needs_reauth' || status === 'error'
  const isNeverConnected = !integration

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <ProviderIcon provider={provider} size={24} />
          <p className="text-sm font-semibold text-text-primary truncate">{getProviderLabel(provider)}</p>
        </div>
        <Badge value={isNeverConnected ? 'disconnected' : status} size="sm" />
      </div>

      <div className="text-xs text-text-muted leading-relaxed min-h-[2.5rem]">
        {integration && status === 'connected' ? (
          <>
            <p>
              Connected {formatDate(integration.connected_at)}
              {connectedByName && <> by {connectedByName}</>}
            </p>
            <p>
              Last synced{' '}
              {integration.last_successful_sync_at ? formatRelativeTime(integration.last_successful_sync_at) : 'never'}
            </p>
          </>
        ) : isBroken ? (
          <p>Reconnect to resume syncing data from {getProviderLabel(provider)}.</p>
        ) : (
          <p>Not connected yet.</p>
        )}
      </div>

      {canManage && (
        <div className="flex gap-2 pt-1">
          {status !== 'connected' ? (
            <button
              onClick={onConnect}
              disabled={isConnecting}
              className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium bg-accent-primary text-text-primary hover:brightness-95 disabled:opacity-50 transition-all"
            >
              {isConnecting ? 'Connecting…' : isBroken ? 'Reconnect' : 'Connect'}
            </button>
          ) : (
            <button
              onClick={onDisconnect}
              disabled={isDisconnecting}
              className="flex-1 px-3 py-1.5 rounded-md text-sm font-medium border border-border text-text-primary hover:bg-surface-base disabled:opacity-50 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      )}
    </Card>
  )
}

function ComingSoonCard({ provider, label, canManage }: { provider: FutureProvider; label: string; canManage: boolean }) {
  return (
    <Card className="flex flex-col gap-3 opacity-70">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <ProviderIcon provider={provider} size={24} />
          <p className="text-sm font-semibold text-text-primary truncate">{label}</p>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-accent-neutral text-xs font-medium text-text-muted whitespace-nowrap">
          Coming soon
        </span>
      </div>
      <div className="text-xs text-text-muted leading-relaxed min-h-[2.5rem]">
        <p>Not yet available — planned for a future release.</p>
      </div>
      {canManage && (
        <div className="pt-1">
          <button
            disabled
            className="w-full px-3 py-1.5 rounded-md text-sm font-medium border border-border text-text-muted cursor-not-allowed"
          >
            Connect
          </button>
        </div>
      )}
    </Card>
  )
}

function CategorySection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div>
      <div className="py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">{children}</div>
    </div>
  )
}

export default function IntegrationsPage() {
  const { companyId, canManageIntegrations } = useCompanyContext()
  const canManage = canManageIntegrations

  const { data: integrations, isLoading, isError, error, refetch } = useIntegrations(companyId)
  const { data: members } = useCompanyMembers(companyId)
  const connectMutation = useConnectIntegration(companyId)
  const disconnectMutation = useDisconnectIntegration(companyId)
  const addToast = useToastStore((s) => s.addToast)
  const [disconnectTarget, setDisconnectTarget] = useState<IntegrationConnection | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<Provider | null>(null)

  const hasEcommerce = integrations?.some((i) => ECOMMERCE_PROVIDERS.includes(i.provider) && i.status === 'connected')
  const hasMetaAds = integrations?.some((i) => i.provider === 'meta_ads' && i.status === 'connected')

  const handleConnect = (provider: Provider) => {
    setConnectingProvider(provider)
    connectMutation.mutate(provider, {
      onSuccess: () => addToast(`${getProviderLabel(provider)} connected.`, 'success'),
      onError: () => addToast(`Couldn't connect ${getProviderLabel(provider)}. Please try again.`, 'error'),
      onSettled: () => setConnectingProvider(null),
    })
  }

  const handleConfirmDisconnect = () => {
    if (!disconnectTarget) return
    disconnectMutation.mutate(disconnectTarget.id, {
      onSuccess: () => addToast(`${getProviderLabel(disconnectTarget.provider)} disconnected.`, 'info'),
      onError: () => addToast('Something went wrong. Please try again.', 'error'),
      onSettled: () => setDisconnectTarget(null),
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Integrations</h1>
        <p className="text-sm text-text-muted mt-0.5">Connect and monitor the data sources your KPIs and reports depend on.</p>
      </div>

      {!isLoading && !isError && !hasEcommerce && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-status-info bg-status-info-bg">
          <ShoppingCart size={16} className="text-status-info mt-0.5 shrink-0" aria-hidden />
          <p className="text-sm text-status-info">
            Connect Amazon or Tiendanube to start computing KPIs and generating reports.
          </p>
        </div>
      )}
      {!isLoading && !isError && hasEcommerce && !hasMetaAds && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-lg border border-border bg-surface-card">
          <Info size={16} className="text-text-muted mt-0.5 shrink-0" aria-hidden />
          <p className="text-sm text-text-muted">
            Connecting Meta Ads is optional, but unlocks marketing KPIs and reports.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <ErrorState title="Couldn't load your integrations" error={error} onRetry={() => void refetch()} />
        </Card>
      ) : (
        <div className="space-y-8">
          {INTEGRATION_CATEGORIES.map((category) => (
            <CategorySection key={category.key} title={category.title} description={category.description}>
              {INTEGRATION_CATALOG.filter((entry) => entry.category === category.key).map((entry) => {
                if (entry.comingSoon) {
                  return <ComingSoonCard key={entry.id} provider={entry.id} label={entry.label} canManage={canManage} />
                }
                const integration = integrations?.find((i) => i.provider === entry.id)
                const connectedByName = integration
                  ? members?.find((m) => m.user_id === integration.connected_by_user_id)?.user.name ?? null
                  : null
                return (
                  <IntegrationCard
                    key={entry.id}
                    provider={entry.id}
                    integration={integration}
                    canManage={canManage}
                    connectedByName={connectedByName}
                    isConnecting={connectingProvider === entry.id}
                    isDisconnecting={disconnectMutation.isPending && disconnectTarget?.provider === entry.id}
                    onConnect={() => handleConnect(entry.id)}
                    onDisconnect={() => integration && setDisconnectTarget(integration)}
                  />
                )
              })}
            </CategorySection>
          ))}
        </div>
      )}

      <Modal
        open={!!disconnectTarget}
        onClose={() => setDisconnectTarget(null)}
        title={`Disconnect ${disconnectTarget ? getProviderLabel(disconnectTarget.provider) : ''}?`}
      >
        <p className="text-sm text-text-muted mb-5">
          This will affect what KPIs and reports can be computed going forward. You can reconnect at any time.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setDisconnectTarget(null)}
            className="px-4 py-2 rounded-md text-sm font-medium border border-border text-text-primary hover:bg-surface-base transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDisconnect}
            disabled={disconnectMutation.isPending}
            className="px-4 py-2 rounded-md text-sm font-medium bg-status-critical text-text-inverse hover:brightness-110 disabled:opacity-50 transition-all"
          >
            {disconnectMutation.isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
