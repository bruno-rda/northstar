import { useQuery } from '@tanstack/react-query'
import { getCompanyMembersOptions } from '@/api/@tanstack/react-query.gen'

export function useCompanyMembers(companyId: string) {
  return useQuery({ ...getCompanyMembersOptions({ path: { company_id: companyId } }), enabled: Boolean(companyId) })
}
