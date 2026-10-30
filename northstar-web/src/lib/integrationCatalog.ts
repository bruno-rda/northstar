import type { Provider } from '@/api'

// A.23 (V1 Integration Set) names Mercado Libre and Shopify as explicit future scope,
// beyond the four providers the mock API actually implements. They're display-only —
// never passed to any api/index.ts function — so they live here rather than widening
// the real `Provider` contract type. See docs/DECISIONS.md.
export type FutureProvider = 'mercado_libre' | 'shopify'
export type CatalogProviderId = Provider | FutureProvider

export type IntegrationCategory = 'ecommerce' | 'advertising' | 'analytics'

export type CatalogEntry =
  | { id: Provider; label: string; category: IntegrationCategory; comingSoon?: false }
  | { id: FutureProvider; label: string; category: IntegrationCategory; comingSoon: true }

export const INTEGRATION_CATALOG: CatalogEntry[] = [
  { id: 'amazon', label: 'Amazon', category: 'ecommerce' },
  { id: 'tiendanube', label: 'Tiendanube', category: 'ecommerce' },
  { id: 'mercado_libre', label: 'Mercado Libre', category: 'ecommerce', comingSoon: true },
  { id: 'shopify', label: 'Shopify', category: 'ecommerce', comingSoon: true },
  { id: 'meta_ads', label: 'Meta Ads', category: 'advertising' },
  { id: 'google_analytics', label: 'Google Analytics', category: 'analytics' },
]

// Section names follow §4.2's "e-commerce integration" wording and §6's KPI category
// labels ("Advertising & Spend", "Sessions & Funnel") — the closest documented
// terminology for how these providers group together.
export const INTEGRATION_CATEGORIES: { key: IntegrationCategory; title: string; description: string }[] = [
  {
    key: 'ecommerce',
    title: 'E-Commerce',
    description: 'At least one connected source here is required before KPIs or reports can be computed.',
  },
  {
    key: 'advertising',
    title: 'Advertising & Spend',
    description: 'Optional, but unlocks marketing-area KPIs like ROAS and CAC.',
  },
  {
    key: 'analytics',
    title: 'Sessions & Funnel',
    description: 'Optional, but unlocks marketing-area session and funnel KPIs.',
  },
]

// Helper to get provider display label — single source of truth for all provider names.
// Falls back to the provider id if not found (e.g., for unknown or future providers).
export function getProviderLabel(providerId: string): string {
  const entry = INTEGRATION_CATALOG.find((e) => e.id === providerId)
  return entry ? entry.label : providerId
}
