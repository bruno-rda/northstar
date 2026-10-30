import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { getCompaniesOptions } from '@/api/@tanstack/react-query.gen'
import type { GetCompaniesData } from '@/api'

export type UseCompaniesParams = NonNullable<GetCompaniesData['query']>

export function useCompanies(params: UseCompaniesParams) {
  return useQuery({
    ...getCompaniesOptions({ query: { ...params, page_size: params.page_size ?? 10 } }),
    placeholderData: keepPreviousData,
  })
}
