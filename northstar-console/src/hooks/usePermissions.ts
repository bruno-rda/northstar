import { useQuery } from '@tanstack/react-query'
import { getPermissionsOptions } from '@/api/@tanstack/react-query.gen'

export function usePermissions() {
  return useQuery({ ...getPermissionsOptions(), staleTime: Infinity })
}
