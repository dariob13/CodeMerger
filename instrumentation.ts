// Runs once when the server starts: automations have to fire even if no page is open.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { startScheduler } = await import("@/lib/server/automations")
  startScheduler()
}
