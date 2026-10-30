import { useQuery } from '@tanstack/react-query'
import { getStrategicContextOptions } from '@/api/@tanstack/react-query.gen'

export function useStrategicContext(companyId: string) {
  return useQuery({ ...getStrategicContextOptions({ path: { company_id: companyId } }), enabled: Boolean(companyId) })
}
