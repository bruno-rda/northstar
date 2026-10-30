type SwitchProps = {
  checked: boolean
  onChange: (next: boolean) => void
  ariaLabel: string
  disabled?: boolean
}

export function Switch({ checked, onChange, ariaLabel, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50 disabled:opacity-50 ${
        checked ? 'bg-accent-primary' : 'bg-accent-neutral'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-surface-card shadow-sm transition-transform ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}
