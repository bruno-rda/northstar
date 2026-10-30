import type { Provider } from '@/api'

const PROVIDER_ICON_SRC: Record<Provider, string> = {
  amazon: '/providers/amazon.svg',
  tiendanube: '/providers/tiendanube.svg',
  meta_ads: '/providers/meta_ads.svg',
  google_analytics: '/providers/google_analytics.svg',
}

type ProviderIconProps = {
  provider: Provider
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
