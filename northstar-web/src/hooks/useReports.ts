import { useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { generateReport } from '@/api'
import {
  canGenerateReportOptions,
  getLatestReportAttemptOptions,
  getReportOptions,
  getReportsOptions,
} from '@/api/@tanstack/react-query.gen'
import type { Area } from '@/api'
import { invalidateOperations } from '@/lib/queryKeys'

export function useReports(companyId: string, area: Area, page: number, pageSize = 10) {
  return useQuery({
    ...getReportsOptions({ path: { company_id: companyId }, query: { area, page, page_size: pageSize } }),
    staleTime: 1000 * 60 * 30,
  })
}

export function useReport(companyId: string, reportId: string | undefined) {
  return useQuery({
    ...getReportOptions({ path: { company_id: companyId, report_id: reportId ?? '' } }),
    enabled: !!reportId,
    staleTime: Infinity,
  })
}

export function useCanGenerateReport(companyId: string, area: Area) {
  return useQuery({
    ...canGenerateReportOptions({ path: { company_id: companyId }, query: { area } }),
    staleTime: 1000 * 30,
  })
}

export function useGenerateReport(companyId: string, area: Area) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => generateReport({ path: { company_id: companyId }, body: { area } }),
    onSuccess: () =>
      invalidateOperations(queryClient, companyId, ['getReports', 'canGenerateReport', 'getLatestReportAttempt']),
  })
}

// Powers the Reports page's "Generating…" / failed-attempt states on load, without
// needing an attempt id already in hand.
export function useLatestReportAttempt(companyId: string, area: Area) {
  const queryClient = useQueryClient()
  const query = useQuery({
    ...getLatestReportAttemptOptions({ path: { company_id: companyId }, query: { area } }),
    refetchInterval: (q) => (q.state.data?.outcome === 'in_progress' ? 2000 : false),
    staleTime: 1000 * 15,
  })

  // Refresh what a finished generation produces, but only on the in_progress → settled
  // transition, not on every visit that loads an already-settled attempt.
  const outcome = query.data?.outcome
  const previousOutcome = useRef(outcome)
  useEffect(() => {
    const wasGenerating = previousOutcome.current === 'in_progress'
    previousOutcome.current = outcome
    if (!wasGenerating || !outcome || outcome === 'in_progress') return
    void invalidateOperations(queryClient, companyId, ['getReports', 'getActionItems', 'getAlerts', 'canGenerateReport'])
  }, [outcome, companyId, queryClient])

  return query
}
