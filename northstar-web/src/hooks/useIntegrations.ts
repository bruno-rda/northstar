import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { startIntegrationOauth, disconnectIntegration, completeIntegrationOauth } from '@/api'
import { getIntegrationsOptions } from '@/api/@tanstack/react-query.gen'
import type { Provider } from '@/api'
import { invalidateOperations, type OperationId } from '@/lib/queryKeys'

// Everything whose answer depends on which integrations are connected.
const INTEGRATION_DEPENDENTS: OperationId[] = [
  'getIntegrations',
  'getDashboardBriefing',
  'canGenerateReport',
  'getKpiSummary',
  'getKpiValues',
  'getDailySales',
  'getProductContribution',
  'getAlerts',
]

export function useIntegrations(companyId: string) {
  return useQuery({ ...getIntegrationsOptions({ path: { company_id: companyId } }), staleTime: 1000 * 30 })
}

// Connect and Reconnect both drive the same OAuth flow (§4.2). The mock backend has no
// real redirect, so start and complete are chained.
export function useConnectIntegration(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (provider: Provider) => {
      await startIntegrationOauth({ path: { company_id: companyId, provider } })
      return completeIntegrationOauth({ path: { company_id: companyId, provider } })
    },
    onSuccess: () => invalidateOperations(queryClient, companyId, INTEGRATION_DEPENDENTS),
  })
}

export function useDisconnectIntegration(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (integrationId: string) =>
      disconnectIntegration({ path: { company_id: companyId, integration_id: integrationId } }),
    onSuccess: () => invalidateOperations(queryClient, companyId, INTEGRATION_DEPENDENTS),
  })
}
