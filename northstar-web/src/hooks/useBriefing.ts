import { useQuery } from '@tanstack/react-query'
import { getDashboardBriefingOptions } from '@/api/@tanstack/react-query.gen'
import type { Area } from '@/api'

export function useDashboardBriefing(companyId: string, area: Area) {
  return useQuery(getDashboardBriefingOptions({ path: { company_id: companyId }, query: { area } }))
}
