/**
 * The lesson's live plan map — `lessons/<slug>/plan.md`. Pure text functions;
 * the md-log hook calls them when a Predict/Check question names a node.
 *
 * plan.md shape (written by /teach, restyled here):
 *
 *   ---
 *   lesson: <lesson-slug>
 *   goal: <node-slug>
 *   current:
 *   visited: []
 *   ---
 *   # Plan — <topic>
 *   <approach prose>
 *
 *   ```mermaid
 *   graph TD
 *     slug-a["Label"]          one node declaration per line
 *     slug-a --> slug-b        one edge per line: from = required before to
 *     %% status — managed by md-log, do not edit below
 *     classDef visited ...
 *     class slug-a visited
 *   ```
 *
 * The position is simply the latest tagged node (learnharness semantics): a
 * tag is a position, never a verdict, and nodes are never marked finished.
 */

const MERMAID = /```mermaid\r?\n([\s\S]*?)```/
const SLUG = "[a-z0-9_-]+"
const DECL = new RegExp(`^\\s*(${SLUG})\\s*[\\[\\(\\{]`)
const EDGE = new RegExp(`^\\s*(${SLUG})\\s*-->\\s*(${SLUG})\\s*$`)
const STATUS_MARKER = "%% status — managed by md-log, do not edit below"

const STYLE = [
  "classDef visited fill:#e8f0e8,stroke:#5a8a5a,color:#2d4a2d",
  "classDef current fill:#fff2cc,stroke:#d6a500,stroke-width:3px,color:#000",
]

/** Every node slug the plan's mermaid block declares or connects. */
export function planSlugs(text) {
  const block = MERMAID.exec(String(text ?? ""))
  if (!block) return []
  const slugs = new Set()
  for (const line of block[1].split(/\r?\n/)) {
    if (line.trim().startsWith(STATUS_MARKER.slice(0, 9))) break
    const edge = EDGE.exec(line)
    if (edge) {
      slugs.add(edge[1])
      slugs.add(edge[2])
      continue
    }
    const decl = DECL.exec(line)
    if (decl && !/^(graph|flowchart|classDef|class|style|subgraph|end)$/.test(decl[1])) slugs.add(decl[1])
  }
  return [...slugs]
}

function readFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)
  if (!m) return { current: null, visited: [] }
  const current = /^current:[ \t]*(\S*)[ \t]*$/m.exec(m[1])?.[1] || null
  const visitedRaw = /^visited:[ \t]*\[(.*)\][ \t]*$/m.exec(m[1])?.[1] ?? ""
  const visited = visitedRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  return { current, visited }
}

function writeFrontmatter(text, { current, visited }) {
  return text.replace(/^---\r?\n([\s\S]*?)\r?\n---/, (_whole, body) => {
    let next = body
    const cur = `current: ${current ?? ""}`.trimEnd()
    const vis = `visited: [${visited.join(", ")}]`
    next = /^current:.*$/m.test(next) ? next.replace(/^current:.*$/m, cur) : `${next}\n${cur}`
    next = /^visited:.*$/m.test(next) ? next.replace(/^visited:.*$/m, vis) : `${next}\n${vis}`
    return `---\n${next}\n---`
  })
}

function restyleMermaid(text, { current, visited }) {
  return text.replace(MERMAID, (_whole, body) => {
    const kept = []
    for (const line of body.replace(/\s+$/, "").split(/\r?\n/)) {
      if (line.trim().startsWith(STATUS_MARKER.slice(0, 9))) break
      kept.push(line)
    }
    const status = [`  ${STATUS_MARKER}`, ...STYLE.map((s) => `  ${s}`)]
    const done = visited.filter((v) => v !== current)
    if (done.length) status.push(`  class ${done.join(",")} visited`)
    if (current) status.push(`  class ${current} current`)
    return "```mermaid\n" + [...kept, ...status].join("\n") + "\n```"
  })
}

/**
 * Move the plan's position to `node`. The previous current node joins
 * `visited`. Returns `{ text, known }`; an unknown slug leaves the text as-is
 * so the hook can warn instead.
 */
export function restylePlan(text, node) {
  const slug = String(node ?? "").toLowerCase()
  if (!planSlugs(text).includes(slug)) return { text, known: false }
  const fm = readFrontmatter(text)
  const visited = [...fm.visited]
  if (fm.current && fm.current !== slug && !visited.includes(fm.current)) visited.push(fm.current)
  const state = { current: slug, visited }
  return { text: restyleMermaid(writeFrontmatter(text, state), state), known: true }
}
