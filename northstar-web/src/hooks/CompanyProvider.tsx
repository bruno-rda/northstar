import { useMemo, type ReactNode } from 'react'
import { useAreaStore } from '@/stores/areaStore'
import { CompanyContext, type CompanyContextValue } from '@/hooks/useCompanyContext'
import { Permission } from '@/api'
import type { Area, MembershipWithCompany } from '@/api'

export function CompanyProvider({
  membership,
  children,
}: {
  membership: MembershipWithCompany
  children: ReactNode
}) {
  const activeAreaRaw = useAreaStore((s) => s.activeAreaByCompany[membership.company_id])
  const setActiveAreaInStore = useAreaStore((s) => s.setActiveArea)

  const value = useMemo<CompanyContextValue>(() => {
    const permissions = membership.permissions
    // Areas a member can see = the areas they hold a view_* permission for.
    const availableAreas: Area[] = []
    if (permissions.includes(Permission.VIEW_GENERAL)) availableAreas.push('general')
    if (permissions.includes(Permission.VIEW_MARKETING)) availableAreas.push('marketing')
    // AppLayout only mounts this provider for memberships holding at least one view_* permission.
    const activeArea = activeAreaRaw && availableAreas.includes(activeAreaRaw) ? activeAreaRaw : (availableAreas[0] ?? 'general')
    const has = (p: Permission) => permissions.includes(p)

    return {
      companyId: membership.company_id,
      membership,
      activeArea,
      setActiveArea: (area: Area) => setActiveAreaInStore(membership.company_id, area),
      availableAreas,
      permissions,
      has,
      // Report generation is area-scoped; the rest are company-wide.
      canCreateReport: has(activeArea === 'general' ? Permission.CREATE_GENERAL_REPORT : Permission.CREATE_MARKETING_REPORT),
      canManageIntegrations: has(Permission.MANAGE_INTEGRATIONS),
      canManagePeople: has(Permission.MANAGE_PEOPLE),
    }
  }, [membership, activeAreaRaw, setActiveAreaInStore])

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}
