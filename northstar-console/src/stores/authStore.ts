import { create } from 'zustand'
import type { Staff } from '@/lib/staff'

interface AuthState {
  currentStaff: Staff | null
  setCurrentStaff: (staff: Staff | null) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  currentStaff: null,
  setCurrentStaff: (staff) => set({ currentStaff: staff }),
}))
