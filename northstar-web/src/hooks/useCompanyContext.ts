import { createContext, useContext } from 'react'
import type { Area, MembershipWithCompany, Permission } from '@/api'

export type CompanyContextValue = {
  companyId: string
  membership: MembershipWithCompany
  activeArea: Area
  setActiveArea: (area: Area) => void
  availableAreas: Area[]
  permissions: Permission[]
  has: (permission: Permission) => boolean
  canCreateReport: boolean // gates the Generate action for the active area
  canManageIntegrations: boolean
  canManagePeople: boolean
}

export const CompanyContext = createContext<CompanyContextValue | null>(null)

export function useCompanyContext() {
  const ctx = useContext(CompanyContext)
  if (!ctx) throw new Error('useCompanyContext must be used within CompanyProvider')
  return ctx
}
