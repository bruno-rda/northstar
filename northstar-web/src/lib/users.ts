import type { User } from '@/api'

// TODO: Get users from firebase when implementing SSO
export const USERS: User[] = [
  { id: 'user_1', name: 'Carlos Mendez', email: 'carlos@matelargo.com', created_at: '2025-09-01T10:00:00Z' },
  { id: 'user_1b', name: 'Lucía Martínez', email: 'lucia@matelargo.com', created_at: '2025-09-05T10:00:00Z' },
  { id: 'user_1c', name: 'Martín Ibarra', email: 'martin@matelargo.com', created_at: '2026-02-10T10:00:00Z' },
  { id: 'user_2', name: 'Ana García', email: 'ana@fuerzanatural.mx', created_at: '2025-10-15T14:00:00Z' },
  { id: 'user_2b', name: 'Luis Fernández', email: 'luis@fuerzanatural.mx', created_at: '2025-11-20T10:00:00Z' },
  { id: 'user_3', name: 'Diego Torres', email: 'diego@techwearba.com', created_at: '2026-04-01T11:00:00Z' },
  { id: 'user_3b', name: 'Camila Ruiz', email: 'camila@techwearba.com', created_at: '2026-04-15T10:00:00Z' },
  { id: 'user_4', name: 'Sofía Rojas', email: 'sofia@casaverde.co', created_at: '2026-06-01T09:00:00Z' },
  { id: 'user_5', name: 'Roberto Silva', email: 'roberto@sportify.com.ar', created_at: '2025-11-01T10:00:00Z' },
  { id: 'user_6', name: 'Valentina Cruz', email: 'valentina@lunacosmetics.cl', created_at: '2025-08-15T09:00:00Z' },
  { id: 'user_6b', name: 'Javier Paredes', email: 'javier@lunacosmetics.cl', created_at: '2025-09-10T09:00:00Z' },
  { id: 'user_8', name: 'Nicolás Fabbri', email: 'nicolas@brighthome.uy', created_at: '2026-05-15T11:00:00Z' },
  { id: 'user_renata', name: 'Renata Ibarra', email: 'renata@insightgrowth.co', created_at: '2026-01-10T09:00:00Z' },
]

export function signIn(email: string): User {
  const user = USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
  if (!user) {
    const detail = "We couldn't find an account for that email. Contact your NORTHSTAR representative for access."
    throw Object.assign(new Error(detail), { status_code: 404, detail })
  }
  return user
}
