import { useQuery } from '@tanstack/react-query'
import { getCompanyOptions } from '@/api/@tanstack/react-query.gen'

export function useCompany(companyId: string) {
  return useQuery({ ...getCompanyOptions({ path: { company_id: companyId } }), enabled: Boolean(companyId) })
}
