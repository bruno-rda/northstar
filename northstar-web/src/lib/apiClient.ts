import { client } from '@/api/client.gen'
import { useAuthStore } from '@/stores/authStore'

if (!import.meta.env.VITE_API_URL) {
  throw new Error('[api] VITE_API_URL is not set')
}

client.setConfig({ baseUrl: import.meta.env.VITE_API_URL })

// USER_STUB: send the signed-in user id as the mock auth header until Firebase lands.
client.interceptors.request.use((request) => {
  const userId = useAuthStore.getState().currentUser?.id
  if (userId) request.headers.set('X-Mock-User', userId)
  return request
})

// Attach the HTTP status so callers can tell "not found" from "failed" (see lib/errors.ts).
client.interceptors.error.use((error, response) => ({
  ...(typeof error === 'object' && error !== null ? error : { detail: error }),
  status: response?.status,
}))
