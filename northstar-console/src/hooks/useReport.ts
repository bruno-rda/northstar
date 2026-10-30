import { useQuery } from '@tanstack/react-query'
import { getReportOptions } from '@/api/@tanstack/react-query.gen'

export function useReport(companyId: string, reportId: string) {
  return useQuery({
    ...getReportOptions({ path: { company_id: companyId, report_id: reportId } }),
    enabled: Boolean(companyId) && Boolean(reportId),
  })
}
