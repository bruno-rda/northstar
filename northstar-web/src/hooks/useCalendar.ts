import { useQuery } from '@tanstack/react-query'
import { getCalendarOptions } from '@/api/@tanstack/react-query.gen'

export function useCalendar(companyId: string) {
  return useQuery(getCalendarOptions({ path: { company_id: companyId } }))
}
