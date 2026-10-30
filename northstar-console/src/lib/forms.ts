export function inputClass(hasError?: boolean) {
  return `w-full px-3 py-2 rounded-md border text-sm text-text-primary bg-surface-card placeholder:text-text-muted
    focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors
    ${hasError ? 'border-status-critical' : 'border-border'}`
}

// Key products are entered one per line; at most three are kept.
export function parseProductLines(text?: string): string[] {
  return (text ?? '').split('\n').map((p) => p.trim()).filter(Boolean).slice(0, 3)
}
