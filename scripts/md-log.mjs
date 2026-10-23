#!/usr/bin/env node
/**
 * md-log — mirror a Claude Code session into a markdown file for comfortable
 * reading in Obsidian.
 *
 * Port of the pi `md-log` extension. pi could hook the agent's event stream
 * directly; Claude Code can't, so the same job is done with three hooks that
 * all run THIS script (dispatching on `hook_event_name` from stdin):
 *
 *   PreToolUse  (AskUserQuestion) — flush pending prose, then write the QUESTION
 *                                   block BEFORE the popup renders, so a
 *                                   LaTeX-heavy question can be read rendered in
 *                                   Obsidian while the terminal waits.
 *   PostToolUse (AskUserQuestion) — append the answer the learner picked.
 *   Stop                          — flush the rest of the turn's prose.
 *
 * Captures only reading-relevant content: user prompts, assistant text, and
 * AskUserQuestion Q&A. All other tool traffic (Bash, Read, Edit, Agent, ...) is
 * omitted, as is subagent chatter (`isSidechain`) and thinking.
 *
 * Flushing is watermark-driven off the transcript JSONL, and PreToolUse flushes
 * BEFORE writing its question block. That ordering is what keeps the log
 * faithful: prose that preceded a question stays above it in the file.
 *
 * Grading note: unlike pi's `quiz` tool, the correct answer is never a tool
 * parameter here — the agent holds it and opens its next message with the
 * verdict. So the answer callout below is deliberately neutral; the check/cross
 * and the explanation arrive as the assistant prose that follows it.
 *
 * Plan map: when a Predict/Check question carries `[node: <slug>]`, PreToolUse
 * also moves `plan.md` (next to the linked log) to that node, and PostToolUse
 * tells the agent if the slug isn't in the plan. Formatting lives in
 * lib/md-format.mjs, the plan restyle in lib/plan.mjs.
 *
 * Append-only. Never blocks a turn: every path exits 0.
 *
 * CLI (used by the /md-log and /md-unlog commands):
 *   node md-log.mjs --link <path>   link a file; the session backfills on next flush
 *   node md-log.mjs --unlink        stop logging
 */

import {
  CLAUDE_DIR,
  dirname,
  existsSync,
  join,
  mkdirSync,
  readFileSync,
  resolve,
  writeFileSync,
} from "./_common.mjs"
import {
  answerCallouts,
  assistantBlock,
  cleanUserText,
  isGraded,
  questionCallout,
  splitNodeTag,
  userBlock,
} from "./lib/md-format.mjs"
import { restylePlan } from "./lib/plan.mjs"

const STATE_PATH = join(CLAUDE_DIR, ".md-log-state.json")
const QA_TOOL = "AskUserQuestion"

// ── state ───────────────────────────────────────────────────────────────────
// { "<session_id>": { file, lastLine }, "__pending": { file } }
//
// `__pending` exists because /md-log runs as a plain CLI call and has no way to
// learn the session id. It parks the request; the next hook invocation (which
// does know its session id) claims it. An unlink parks { file: null }.

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"))
  } catch {
    return {}
  }
}

function writeState(state) {
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8")
}

function append(file, text) {
  try {
    mkdirSync(dirname(file), { recursive: true })
    let current = ""
    if (existsSync(file)) current = readFileSync(file, "utf8")
    const prefix = current.trim().length > 0 ? "\n\n" : ""
    writeFileSync(file, current + prefix + text + "\n", "utf8")
  } catch {
    // File may have been deleted or locked externally; logging must never throw.
  }
}

/**
 * Append every not-yet-logged transcript entry, advancing the watermark.
 * Idempotent by watermark, so it is safe to call from any hook.
 */
function flush(entry, transcriptPath) {
  if (!transcriptPath || !existsSync(transcriptPath)) return
  let lines
  try {
    lines = readFileSync(transcriptPath, "utf8").split("\n")
  } catch {
    return
  }

  let lastGood = entry.lastLine ?? 0
  for (let i = lastGood; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) {
      lastGood = i + 1
      continue
    }
    let o
    try {
      o = JSON.parse(line)
    } catch {
      // Possibly a partially-flushed final line; leave the watermark here so the
      // next hook re-reads it once complete.
      break
    }
    lastGood = i + 1

    if (o.isSidechain || o.isMeta) continue // subagent chatter / harness meta

    if (o.type === "user") {
      // Only real typed prompts: tool_result and turn-companion entries carry
      // array content and are not part of the lesson.
      if (typeof o.message?.content !== "string") continue
      const text = cleanUserText(o.message.content)
      if (text) append(entry.file, userBlock(text))
    } else if (o.type === "assistant") {
      const parts = (o.message?.content ?? [])
        .filter((c) => c.type === "text")
        .map((c) => String(c.text ?? "").trim())
        .filter(Boolean)
      if (parts.length) append(entry.file, assistantBlock(parts.join("\n\n")))
    }
  }
  entry.lastLine = lastGood
}

// ── CLI mode (/md-log, /md-unlog) ───────────────────────────────────────────

function cli(argv) {
  const state = readState()
  const i = argv.indexOf("--link")
  if (i !== -1) {
    const raw = argv[i + 1]
    if (!raw) {
      process.stdout.write("md-log: --link needs a file path\n")
      return 1
    }
    const abs = resolve(process.cwd(), raw.replace(/^["']|["']$/g, ""))
    state.__pending = { file: abs }
    writeState(state)
    process.stdout.write(
      `md-log: linked -> ${abs}\n(backfills this session on the next assistant turn)\n`,
    )
    return 0
  }
  if (argv.includes("--unlink")) {
    state.__pending = { file: null }
    writeState(state)
    process.stdout.write("md-log: unlinked (logging stops after this turn)\n")
    return 0
  }
  process.stdout.write("usage: md-log.mjs --link <path> | --unlink\n")
  return 1
}

// ── hook mode ───────────────────────────────────────────────────────────────

function readStdin() {
  return new Promise((res) => {
    let buf = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (d) => (buf += d))
    process.stdin.on("end", () => res(buf))
    process.stdin.on("error", () => res(""))
  })
}

// ── plan map (lessons/<slug>/plan.md, next to the linked log) ───────────────

const planPath = (logFile) => join(dirname(logFile), "plan.md")

function taggedNodes(questions) {
  return questions.filter(isGraded).map((q) => splitNodeTag(q.question).node).filter(Boolean)
}

function movePlan(logFile, questions) {
  const node = taggedNodes(questions).at(-1)
  const path = planPath(logFile)
  if (!node || !existsSync(path)) return
  try {
    const before = readFileSync(path, "utf8")
    const { text, known } = restylePlan(before, node)
    if (known && text !== before) writeFileSync(path, text, "utf8")
  } catch {
    // A locked or half-written plan must never block a turn.
  }
}

function unknownNodes(logFile, questions) {
  const path = planPath(logFile)
  if (!existsSync(path)) return []
  try {
    const text = readFileSync(path, "utf8")
    return taggedNodes(questions).filter((n) => !restylePlan(text, n).known)
  } catch {
    return []
  }
}

/** Feed a note back to the agent (PostToolUse additionalContext). */
function warn(message) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `md-log: ${message}` } }),
  )
}

async function hook() {
  const raw = await readStdin()
  let ev
  try {
    ev = JSON.parse(raw)
  } catch {
    return
  }

  const sid = ev.session_id
  if (!sid) return
  const state = readState()

  // Claim a parked /md-log or /md-unlog request for this session.
  if (state.__pending) {
    const pending = state.__pending
    delete state.__pending
    if (pending.file) state[sid] = { file: pending.file, lastLine: 0 }
    else delete state[sid]
    writeState(state)
  }

  const entry = state[sid]
  if (!entry?.file) return // not linked — nothing to do

  const event = ev.hook_event_name

  if (event === "PreToolUse" && ev.tool_name === QA_TOOL) {
    // Flush FIRST so prose written before the question stays above it.
    flush(entry, ev.transcript_path)
    for (const q of ev.tool_input?.questions ?? []) {
      const block = questionCallout(q)
      if (block) append(entry.file, block)
    }
    // Move the plan map BEFORE the popup too, so Obsidian shows where we are.
    movePlan(entry.file, ev.tool_input?.questions ?? [])
  } else if (event === "PostToolUse" && ev.tool_name === QA_TOOL) {
    const res = ev.tool_response ?? {}
    const answers = res.answers ?? {}
    const questions = res.questions ?? ev.tool_input?.questions ?? []
    for (const block of answerCallouts(questions, answers)) append(entry.file, block)
    const unknown = unknownNodes(entry.file, questions)
    if (unknown.length) warn(`plan.md has no node ${unknown.map((n) => `"${n}"`).join(", ")} — the plan map did not move. Use a slug from the plan's mermaid block, or re-write plan.md if the structure changed.`)
  } else if (event === "Stop") {
    flush(entry, ev.transcript_path)
  }

  state[sid] = entry
  writeState(state)
}

// ── entry ───────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
if (argv.length > 0) {
  process.exit(cli(argv))
} else {
  hook()
    .catch(() => {})
    .finally(() => process.exit(0)) // logging must never block a turn
}
