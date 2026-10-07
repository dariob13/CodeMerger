import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { test } from "node:test"
import ts from "typescript"

async function load(file) {
  const source = await fs.readFile(new URL(file, import.meta.url), "utf8")
  const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } })
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)
}
const { groupReplyParts, commandGroupSummary } = await load("../lib/command-groups.ts")
const { applyEvent } = await load("../lib/types.ts")
const tool = (id, status = "done", name = "bash") => ({ type: "tool", id, name, status, detail: `command ${id}` })

test("groups adjacent tools without moving prose or merging groups across text", () => {
  const parts = [{ type: "text", text: "Before" }, tool("a"), tool("b"), { type: "text", text: "Between" }, tool("c"), { type: "text", text: "After" }]
  const blocks = groupReplyParts(parts)
  assert.deepEqual(blocks.map((block) => block.type), ["text", "commands", "text", "commands", "text"])
  assert.deepEqual(blocks[1].tools.map((part) => part.id), ["a", "b"])
  assert.equal(blocks[3].key, "c")
  assert.equal(parts.length, 6)
})

test("streaming updates preserve the disclosure key, details, and failure count", () => {
  const message = { parts: [] }
  applyEvent(message, { type: "tool", tool: { ...tool("a", "running"), startedAt: 1000 } })
  const key = groupReplyParts(message.parts)[0].key
  applyEvent(message, { type: "tool", tool: { id: "a", status: "done", finishedAt: 2000 } })
  applyEvent(message, { type: "tool", tool: { ...tool("b", "running", "read"), startedAt: 2000 } })
  let summary = commandGroupSummary(message.parts)
  assert.equal(groupReplyParts(message.parts)[0].key, key)
  assert.equal(summary.status, "running")
  assert.equal(summary.runningIndex, 1)
  assert.equal(summary.runningTool.detail, "command b")
  applyEvent(message, { type: "tool", tool: { id: "b", status: "error", finishedAt: 19000 } })
  summary = commandGroupSummary(message.parts)
  assert.equal(summary.status, "error")
  assert.equal(summary.failed, 1)
  assert.equal(summary.duration, 18000)
  assert.equal(summary.names, "bash, read")
  assert.equal(message.parts.length, 2)
})

test("shows the latest running command while retaining completed failures", () => {
  const tools = [tool("a", "error"), tool("b", "running"), tool("c", "running")]
  const summary = commandGroupSummary(tools)
  assert.equal(summary.status, "running")
  assert.equal(summary.runningIndex, 2)
  assert.equal(summary.failed, 1)
  tools[1].status = "done"
  tools[2].status = "done"
  assert.equal(commandGroupSummary(tools).status, "error")
})

test("does not invent durations for historical commands; zero timestamps are valid", () => {
  assert.equal(commandGroupSummary([tool("old")]).duration, undefined)
  const timed = { ...tool("timed"), startedAt: 0, finishedAt: 1000 }
  assert.equal(commandGroupSummary([timed]).duration, 1000)
  assert.equal(commandGroupSummary([{ ...timed, finishedAt: -1 }]).duration, 0)
})
