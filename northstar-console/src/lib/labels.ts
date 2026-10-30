import type { Area, CompanyStatus, Provider, ReportAttempt } from '@/api'

export const PROVIDER_LABELS: Record<Provider, string> = {
  amazon: 'Amazon Seller Central',
  tiendanube: 'Tiendanube',
  meta_ads: 'Meta Ads',
  google_analytics: 'Google Analytics',
}

export const AREA_LABELS: Record<Area, string> = { general: 'General', marketing: 'Marketing' }

export const PERIOD_LABELS: Record<ReportAttempt['period_type'], string> = {
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
}

export const COMPANY_STATUS_LABELS: Record<CompanyStatus, string> = {
  created: 'Created',
  onboarding: 'Onboarding',
  active: 'Active',
  suspended: 'Suspended',
  churned: 'Churned',
}
