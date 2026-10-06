// Browser-side calls to the app's own API routes.

export async function api<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/${path}`, {
    method: options.method || "GET",
    headers: options.method ? { "Content-Type": "application/json" } : undefined,
    body: options.method ? JSON.stringify(options.body || {}) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data as T
}
