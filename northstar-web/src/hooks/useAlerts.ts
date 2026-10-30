import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dismissAlert, updateNotificationPreference } from '@/api'
import { getAlertsOptions, getNotificationPreferencesOptions } from '@/api/@tanstack/react-query.gen'
import type { AlertType, GetAlertsData } from '@/api'
import { invalidateOperations } from '@/lib/queryKeys'

export function useAlerts(companyId: string, status: GetAlertsData['query']['status'], page: number, pageSize = 20) {
  return useQuery({
    ...getAlertsOptions({ path: { company_id: companyId }, query: { status, page, page_size: pageSize } }),
    staleTime: 1000 * 30,
  })
}

export function useDismissAlert(companyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (alertId: string) => dismissAlert({ path: { company_id: companyId, alert_id: alertId } }),
    onSuccess: () => invalidateOperations(queryClient, companyId, ['getAlerts']),
  })
}

export function useNotificationPreferences() {
  return useQuery(getNotificationPreferencesOptions())
}

export function useUpdateNotificationPreference() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (vars: { alertType: AlertType; inAppEnabled: boolean; emailEnabled: boolean }) =>
      updateNotificationPreference({
        body: { alert_type: vars.alertType, in_app_enabled: vars.inAppEnabled, email_enabled: vars.emailEnabled },
      }),
    onSuccess: () => invalidateOperations(queryClient, null, ['getNotificationPreferences']),
  })
}
