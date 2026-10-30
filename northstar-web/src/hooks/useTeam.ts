import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { addCompanyMember, removeCompanyMember, updateMemberAccess } from '@/api'
import { getCompanyMembersOptions } from '@/api/@tanstack/react-query.gen'
import type { Permission } from '@/api'
import { invalidateOperations } from '@/lib/queryKeys'

export function useCompanyMembers(companyId: string) {
  return useQuery({ ...getCompanyMembersOptions({ path: { company_id: companyId } }), staleTime: 1000 * 60 * 10 })
}

// A member edit can change the signed-in user's own permissions, which gate the whole app.
function useInvalidateMembers(companyId: string) {
  const queryClient = useQueryClient()
  return () =>
    Promise.all([
      invalidateOperations(queryClient, companyId, ['getCompanyMembers']),
      invalidateOperations(queryClient, null, ['getMyMemberships']),
    ])
}

export function useAddCompanyMember(companyId: string) {
  const invalidate = useInvalidateMembers(companyId)
  return useMutation({
    mutationFn: (vars: { email: string; name?: string; permissions: Permission[] }) =>
      addCompanyMember({
        path: { company_id: companyId },
        body: { email: vars.email, name: vars.name, permissions: vars.permissions },
      }),
    onSuccess: invalidate,
  })
}

export function useUpdateMemberAccess(companyId: string) {
  const invalidate = useInvalidateMembers(companyId)
  return useMutation({
    mutationFn: (vars: { membershipId: string; permissions: Permission[] }) =>
      updateMemberAccess({
        path: { company_id: companyId, membership_id: vars.membershipId },
        body: { permissions: vars.permissions },
      }),
    onSuccess: invalidate,
  })
}

export function useRemoveCompanyMember(companyId: string) {
  const invalidate = useInvalidateMembers(companyId)
  return useMutation({
    mutationFn: (membershipId: string) =>
      removeCompanyMember({ path: { company_id: companyId, membership_id: membershipId } }),
    onSuccess: invalidate,
  })
}
