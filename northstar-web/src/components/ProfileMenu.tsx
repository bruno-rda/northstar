import { useEffect, useRef, useState } from 'react'

type ProfileMenuProps = {
  name: string
  email: string
}

export function ProfileMenu({ name, email }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const initial = name.trim().charAt(0).toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-text-primary text-text-inverse text-sm font-semibold hover:opacity-90 transition-opacity"
        aria-label="Account"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {initial}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-surface-card border border-border rounded-lg shadow-lg py-3 px-4 z-50">
          <p className="text-sm font-medium text-text-primary truncate">{name}</p>
          <p className="text-xs text-text-muted truncate mt-0.5">{email}</p>
        </div>
      )}
    </div>
  )
}
