import { useQuery } from '@tanstack/react-query'
import { getMyMembershipsOptions } from '@/api/@tanstack/react-query.gen'

export function useMyMemberships() {
  return useQuery(getMyMembershipsOptions())
}
