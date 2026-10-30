import type { ReactNode } from 'react'

type CardProps = {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      className={`bg-surface-card rounded-lg border border-border p-6 ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

type CardHeaderProps = {
  title: string
  action?: ReactNode
}

export function CardHeader({ title, action }: CardHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      {action}
    </div>
  )
}
