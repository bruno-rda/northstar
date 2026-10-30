import type { CatalogProviderId } from '@/lib/integrationCatalog'

// Placeholder marks — replace the file contents at public/providers/<provider>.svg
// with the real brand SVG. No code changes needed here when swapping artwork.
const PROVIDER_ICON_SRC: Record<CatalogProviderId, string> = {
  amazon: '/providers/amazon.svg',
  tiendanube: '/providers/tiendanube.svg',
  mercado_libre: '/providers/mercado_libre.svg',
  shopify: '/providers/shopify.svg',
  meta_ads: '/providers/meta_ads.svg',
  google_analytics: '/providers/google_analytics.svg',
}

type ProviderIconProps = {
  provider: CatalogProviderId
  size?: number
}

export function ProviderIcon({ provider, size = 28 }: ProviderIconProps) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full overflow-hidden border border-border bg-surface-base shrink-0"
      style={{ width: size, height: size }}
    >
      <img src={PROVIDER_ICON_SRC[provider]} alt="" className="w-full h-full object-cover" />
    </span>
  )
}
