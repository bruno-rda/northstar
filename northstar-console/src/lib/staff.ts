// TODO: Get staff from firebase when implementing SSO
export type Staff = {
  id: string
  name: string
  email: string
}

export const STAFF: Staff[] = [
  { id: 'staff_1', name: 'Bruno Ramírez', email: 'bruno@gonorthstar.com' },
  { id: 'staff_2', name: 'María González', email: 'maria@gonorthstar.com' },
]

export function getStaffById(id: string): Staff | undefined {
  return STAFF.find((s) => s.id === id)
}
