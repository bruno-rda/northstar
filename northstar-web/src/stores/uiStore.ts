import { create } from 'zustand'

interface UIState {
  sidebarCollapsed: boolean
  sidebarDrawerOpen: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (v: boolean) => void
  toggleSidebarDrawer: () => void
  setSidebarDrawerOpen: (v: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  sidebarDrawerOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebarDrawer: () => set((s) => ({ sidebarDrawerOpen: !s.sidebarDrawerOpen })),
  setSidebarDrawerOpen: (v) => set({ sidebarDrawerOpen: v }),
}))
