import { useQuery } from '@tanstack/react-query'
import { getProductContributionOptions } from '@/api/@tanstack/react-query.gen'
import type { DateRange } from '@/lib/periods'
import type { PlatformScope } from '@/lib/kpiDefinitions'

// Product-mix contribution for the selected range + platform (drives the dashboard pie).
export function useProductContribution(companyId: string, range: DateRange, platformScope: PlatformScope) {
  return useQuery(
    getProductContributionOptions({
      path: { company_id: companyId },
      query: { period_start: range.start, period_end: range.end, platform_scope: platformScope },
    }),
  )
}
