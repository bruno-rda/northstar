import { client } from '@/api/client.gen'
import { useAuthStore } from '@/stores/authStore'

if (!import.meta.env.VITE_API_URL) {
  throw new Error('[api] VITE_API_URL is not set');
}

client.setConfig({ baseUrl: import.meta.env.VITE_API_URL })

// STAFF_STUB: send the selected staff id as the mock auth header until SSO lands.
client.interceptors.request.use((request) => {
  const staffId = useAuthStore.getState().currentStaff?.id
  if (staffId) request.headers.set('X-Mock-Staff', staffId)
  return request
})

// Attach the HTTP status so callers can tell "not found" from "failed" (see lib/errors.ts).
client.interceptors.error.use((error, response) => ({
  ...(typeof error === 'object' && error !== null ? error : { detail: error }),
  status: response?.status,
}))
