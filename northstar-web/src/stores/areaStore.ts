import { create } from 'zustand'
import type { Area } from '@/api'

// Active area is session-scoped per company (§3, §5.3) — a lightweight, same-page
// lens, not a navigation destination, so it deliberately does not live in the URL
// (see Part G routing conventions) or persist across browser restarts.
interface AreaState {
  activeAreaByCompany: Record<string, Area>
  setActiveArea: (companyId: string, area: Area) => void
}

export const useAreaStore = create<AreaState>((set) => ({
  activeAreaByCompany: {},
  setActiveArea: (companyId, area) =>
    set((s) => ({ activeAreaByCompany: { ...s.activeAreaByCompany, [companyId]: area } })),
}))
