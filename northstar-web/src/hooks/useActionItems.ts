import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { updateActionItem } from '@/api'
import { getActionItemsOptions, getActionItemsQueryKey } from '@/api/@tanstack/react-query.gen'
import type { ActionItem, ActionItemStatusUpdate, Area } from '@/api'

export function useActionItems(companyId: string, area: Area) {
  return useQuery(getActionItemsOptions({ path: { company_id: companyId }, query: { area } }))
}

// Optimistic: checking off a "Your actions" item is low-risk and reversible, and rolls
// back on error.
export function useUpdateActionItem(companyId: string, area: Area) {
  const queryClient = useQueryClient()
  const queryKey = getActionItemsQueryKey({ path: { company_id: companyId }, query: { area } })
  return useMutation({
    mutationFn: (vars: { actionItemId: string; status?: ActionItemStatusUpdate['status'] }) =>
      updateActionItem({
        path: { company_id: companyId, action_item_id: vars.actionItemId },
        body: { status: vars.status },
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData(queryKey)
      queryClient.setQueryData(queryKey, (old: ActionItem[] | undefined) =>
        old?.map((item) =>
          item.id === vars.actionItemId
            ? { ...item, ...(vars.status !== undefined ? { status: vars.status } : {}) }
            : item,
        ),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey })
    },
  })
}
