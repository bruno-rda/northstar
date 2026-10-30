import { useMutation } from '@tanstack/react-query'
import { submitAccessRequest } from '@/api'
import type { Options, SubmitAccessRequestData } from '@/api'

export function useSubmitAccessRequest() {
  return useMutation({
    mutationFn: (options: Options<SubmitAccessRequestData>) => submitAccessRequest(options),
  })
}
