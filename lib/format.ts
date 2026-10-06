import type { Schedule } from "@/lib/types"

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" }) // the interface is in English

export function elapsedDuration(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m ${seconds % 60}s`
}

// "5 minutes ago", "in 2 hours", "yesterday".
export function relativeTime(ts: number, now = Date.now()) {
  const seconds = Math.round((ts - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return seconds < 0 ? "just now" : "in a moment"
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute")
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour")
  return relative.format(Math.round(seconds / 86400), "day")
}

export function scheduleLabel(schedule: Schedule) {
  if (schedule.kind === "manual") return "Only when you run it"
  if (schedule.kind === "daily") {
    const [hours, minutes] = schedule.time.split(":").map(Number)
    const at = new Date()
    at.setHours(hours, minutes, 0, 0)
    return `Every day at ${at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
  }
  const { minutes } = schedule
  if (minutes % 1440 === 0) return minutes === 1440 ? "Every day" : `Every ${minutes / 1440} days`
  if (minutes % 60 === 0) return minutes === 60 ? "Every hour" : `Every ${minutes / 60} hours`
  return `Every ${minutes} minutes`
}

// When a usage window starts over: "in 2 hours" if soon, otherwise the day and time.
export function resetLabel(resetsAt: number, now = Date.now()) {
  if (!resetsAt) return "has reset"
  if (resetsAt - now < 20 * 3_600_000) return `resets ${relativeTime(resetsAt, now)}`
  return `resets ${new Date(resetsAt).toLocaleString("en", { weekday: "short", hour: "numeric", minute: "2-digit" })}`
}
