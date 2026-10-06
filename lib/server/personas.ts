// Agents the user sets up: standing duties and a memory, carried into every turn they answer.

import type { AssistantMessage, Persona } from "@/lib/types"
import { newId, saveList } from "./store"

const MEMORY_LIMIT = 200 // entries kept per agent; the oldest are dropped first
const PROMPT_MEMORIES = 100 // entries sent with each turn
const FACT_LIMIT = 500 // chars per entry
const MARKER = /^[ \t]*REMEMBER:[ \t]*(.+?)[ \t]*$/gim

// Sent ahead of every prompt, so the CLI knows its role and what it saved before, even in a new session.
export function personaPreamble(persona: Persona) {
  const memories = persona.memories.slice(-PROMPT_MEMORIES)
  return [
    `You are "${persona.name}", an agent the user set up in Code Merger. Stay in this role for the whole conversation.`,
    "",
    "<duties>",
    persona.duties.trim() || "(none written yet)",
    "</duties>",
    "",
    "<memory>",
    ...(memories.length ? memories.map((m) => `- ${m.text}`) : ["(nothing saved yet)"]),
    "</memory>",
    "The memory above is what you saved in earlier sessions. Rely on it unless the user says otherwise.",
    "To save something for future sessions, end your reply with one line per fact, written exactly as `REMEMBER: <fact>`.",
    "Save only durable facts: the user's preferences, decisions about the project, conventions you discovered.",
    "Do not save anything that only matters to this reply, and do not repeat what is already in memory.",
    "",
    "",
  ].join("\n")
}

export function addMemory(persona: Persona, text: string) {
  const fact = text.replace(/\s+/g, " ").trim().slice(0, FACT_LIMIT)
  if (!fact || persona.memories.some((m) => m.text.toLowerCase() === fact.toLowerCase())) return null
  const memory = { id: newId(), text: fact, ts: Date.now() }
  persona.memories.push(memory)
  if (persona.memories.length > MEMORY_LIMIT) persona.memories.splice(0, persona.memories.length - MEMORY_LIMIT)
  return memory
}

// Moves the reply's REMEMBER lines out of its text and into the agent's memory.
export async function keepMemories(persona: Persona, message: AssistantMessage) {
  const facts: string[] = []
  for (const part of message.parts) {
    if (part.type !== "text") continue
    part.text = part.text
      .replace(MARKER, (_line, fact: string) => (facts.push(fact), ""))
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd()
  }
  message.parts = message.parts.filter((p) => p.type !== "text" || p.text.trim())
  const saved = facts.flatMap((fact) => addMemory(persona, fact)?.text ?? [])
  if (saved.length) message.remembered = saved
  persona.lastUsedAt = Date.now()
  await saveList("personas")
}
