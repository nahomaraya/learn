#!/usr/bin/env node
/**
 * lesson-context — SessionStart hook (matchers: compact, resume).
 *
 * Auto-compaction summarises the transcript, and the learner model is the
 * thing a summary is most likely to blur. So after a compaction or resume,
 * re-inject the active lesson's durable state verbatim: assessment.md (what he
 * knew, per strand) and plan.md (the map and where he is on it). The active
 * lesson is whichever log md-log has linked to this session.
 *
 * Plain stdout from a SessionStart hook becomes context. Never fails a start.
 */

import { CLAUDE_DIR, dirname, existsSync, join, readFileSync } from "./_common.mjs"

function readStdin() {
  return new Promise((res) => {
    let buf = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (d) => (buf += d))
    process.stdin.on("end", () => res(buf))
    process.stdin.on("error", () => res(""))
  })
}

async function main() {
  const ev = JSON.parse((await readStdin()) || "{}")
  const state = JSON.parse(readFileSync(join(CLAUDE_DIR, ".md-log-state.json"), "utf8"))
  const file = state[ev.session_id]?.file
  if (!file) return
  const dir = dirname(file)
  const parts = []
  for (const name of ["assessment.md", "plan.md"]) {
    const path = join(dir, name)
    if (existsSync(path)) parts.push(`### ${name}\n\n${readFileSync(path, "utf8").trim()}`)
  }
  if (parts.length === 0) return
  process.stdout.write(
    [
      `## Active lesson — ${dir.replace(/\\/g, "/")}`,
      "The context was just compacted or resumed. These files are the lesson's durable state; trust them over the summary where they differ. The full transcript is in log.md next to them.",
      ...parts,
    ].join("\n\n") + "\n",
  )
}

main()
  .catch(() => {})
  .finally(() => process.exit(0))
