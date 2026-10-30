import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  hasError?: boolean
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = '', hasError, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        {...props}
        className={`appearance-none pl-3 pr-9 py-2 rounded-md border text-sm text-text-primary bg-surface-card
          cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-primary/50 focus:border-accent-primary transition-colors
          ${hasError ? 'border-status-critical' : 'border-border'} ${className}`}
      >
        {children}
      </select>
      <ChevronDown
        size={14}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
        aria-hidden
      />
    </div>
  )
})
