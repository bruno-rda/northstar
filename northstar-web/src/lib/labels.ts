import type { ReportSummary } from '@/api'

export const PERIOD_TYPE_LABELS: Record<ReportSummary['period_type'], string> = {
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}
