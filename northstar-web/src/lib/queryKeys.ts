import type { QueryClient } from '@tanstack/react-query'
import type * as sdk from '@/api/sdk.gen'

// A generated SDK operation name, e.g. 'getAlerts'. Checked at compile time.
export type OperationId = keyof typeof sdk

type GeneratedKey = { _id?: string; path?: { company_id?: string } }

// Invalidate every cached query of the given operations for one company (all query params),
// matching the `[{ _id, path, query }]` keys the generated `*Options()` helpers produce.
export function invalidateOperations(queryClient: QueryClient, companyId: string | null, ops: OperationId[]) {
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const key = query.queryKey[0] as GeneratedKey | undefined
      if (!key?._id || !ops.includes(key._id as OperationId)) return false
      return companyId === null || key.path?.company_id === companyId
    },
  })
}
