// What the generated client throws: the parsed error body, plus the HTTP status that
// apiClient's error interceptor attaches. Network failures throw a TypeError instead.
export type ApiError = { status?: number; status_code?: number; detail?: unknown }

function asApiError(err: unknown): ApiError | null {
  return typeof err === 'object' && err !== null ? err : null
}

export function getErrorStatus(err: unknown): number | undefined {
  const e = asApiError(err)
  return e?.status ?? e?.status_code
}

export function isNotFound(err: unknown): boolean {
  return getErrorStatus(err) === 404
}

// FastAPI sends `detail` as a string for HTTPException / StoreError, and as an array of
// validation errors for a 422. Never render the raw value: an array crashes React.
export function getErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const detail = asApiError(err)?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail)) {
    const first: unknown = detail[0]
    const msg = typeof first === 'object' && first !== null ? (first as { msg?: unknown }).msg : undefined
    if (typeof msg === 'string') return msg
  }
  return fallback
}

// Retry transient failures only: a 4xx will not change on retry.
export function shouldRetry(failureCount: number, err: unknown): boolean {
  const status = getErrorStatus(err)
  if (status !== undefined && status >= 400 && status < 500) return false
  return failureCount < 2
}
