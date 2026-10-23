/**
 * The knowledge graph — pure functions over one JSON value. Port of
 * learnharness's deterministic merger (src/core/graph.ts) to a single-file
 * store the Obsidian notes are rendered from.
 *
 * Truth lives in `graph/.graph.json` (dot-file: Obsidian ignores it). Every
 * `graph/<id>.md` note is GENERATED from it, so edits to a note are
 * overwritten on the next merge.
 *
 *   {
 *     nodes:    [{ id, name, statement, aliases[], phrasings[], provenance[{source, line?}], createdAt }],
 *     chains:   [{ id, premises[], conclusion, provenance[{source}], createdAt }],
 *     coverage: { "<source path>": { line, prefixHash } }
 *   }
 *
 * A chain is premises that JOINTLY entail a conclusion. Independent reasons
 * for one conclusion are separate chains. Sources are vault-relative paths
 * with forward slashes (`lessons/chain-rule/log.md`, `notes/calc.md`).
 */

import { createHash } from "node:crypto"

export const emptyGraph = () => ({ nodes: [], chains: [], coverage: {} })

export function slugify(name) {
  return (
    String(name ?? "")
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/, "") || "idea"
  )
}

function uniqueId(base, taken) {
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

export const chainKey = (premises, conclusion) => `${[...premises].sort().join("+")}=>${conclusion}`

// ── validation (the extractor's submit laws) ────────────────────────────────

/** null when valid, else the first problem — phrased for the extractor to fix. */
export function validateFindings(findings, existingIds) {
  if (!findings || !Array.isArray(findings.propositions) || !Array.isArray(findings.chains)) {
    return 'findings must be { "propositions": [...], "chains": [...] } — include both fields even when empty.'
  }
  const local = new Set()
  for (const p of findings.propositions) {
    if (!p?.id || !p.name || !p.statement) return `proposition ${JSON.stringify(p?.id ?? p)} needs id, name and statement.`
    if (existingIds.has(p.id)) return `proposition id "${p.id}" collides with an existing graph id — use local ids "p1", "p2", ….`
    local.add(p.id)
  }
  for (const c of findings.chains) {
    if (!Array.isArray(c?.premises) || c.premises.length === 0) {
      return "chains: premises must name at least one proposition — a proposition with no argument stays in the propositions list alone."
    }
    const unknown = [...c.premises, c.conclusion].find((id) => !local.has(id) && !existingIds.has(id))
    if (unknown !== undefined) {
      return `chains: "${unknown}" is neither a submitted proposition id nor an existing graph id — every premise and conclusion must resolve.`
    }
    if (c.premises.includes(c.conclusion)) return `chains: "${c.conclusion}" is both a premise and the conclusion of one chain.`
  }
  return null
}

export function validateVerdicts(verdicts) {
  if (!verdicts || !Array.isArray(verdicts.links)) {
    return 'verdicts must be { "links": [...] } — "links": [] when nothing links.'
  }
  for (const l of verdicts.links) if (!l?.id || !l.linkTo) return `link ${JSON.stringify(l)} needs id and linkTo.`
  return null
}

// ── merge ───────────────────────────────────────────────────────────────────

/**
 * Merge one extraction stretch. Returns a NEW graph plus stats; the input is
 * not mutated. Assumes validateFindings/validateVerdicts passed.
 *
 * A link verdict to an existing node appends the finding's phrasings and
 * provenance to that node (its name never changes). Anything unlinked becomes
 * a new node with a slug id. Chains resolve through this stretch's ids or
 * pass through existing ids verbatim; an identical (premises, conclusion)
 * chain only gains provenance. Then redundant chains are simplified away.
 */
export function mergeFindings(graph, findings, verdicts, { source, now = new Date().toISOString() }) {
  const g = structuredClone(graph)
  const stats = { nodes: 0, linked: 0, chains: 0, droppedChains: 0 }
  const byId = new Map(g.nodes.map((n) => [n.id, n]))
  const linkOf = new Map(verdicts.links.map((l) => [l.id, l.linkTo]))
  const mapping = new Map()

  for (const p of findings.propositions) {
    if (mapping.has(p.id)) continue // duplicate id within one submit — first stands
    const point = p.line ? { source, line: Number(p.line) } : { source }
    const target = byId.get(linkOf.get(p.id))
    if (target) {
      for (const phrase of [p.name, ...(p.aliases ?? [])]) {
        if (phrase !== target.name && !target.aliases.includes(phrase)) target.aliases.push(phrase)
      }
      if (p.statement !== target.statement && !target.phrasings.includes(p.statement)) target.phrasings.push(p.statement)
      if (!target.provenance.some((pt) => pt.source === point.source && pt.line === point.line)) target.provenance.push(point)
      mapping.set(p.id, target.id)
      stats.linked++
    } else {
      const node = {
        id: uniqueId(slugify(p.name), byId),
        name: p.name,
        statement: p.statement,
        aliases: [...new Set((p.aliases ?? []).filter((a) => a !== p.name))],
        phrasings: [],
        provenance: [point],
        createdAt: now,
      }
      g.nodes.push(node)
      byId.set(node.id, node)
      mapping.set(p.id, node.id)
      stats.nodes++
    }
  }

  const resolve = (endpoint) => mapping.get(endpoint) ?? (byId.has(endpoint) ? endpoint : undefined)
  const chainByKey = new Map(g.chains.map((c) => [chainKey(c.premises, c.conclusion), c]))
  for (const chain of findings.chains) {
    const conclusion = resolve(chain.conclusion)
    if (conclusion === undefined) continue
    const premises = [...new Set(chain.premises.map(resolve))].filter((p) => p !== undefined && p !== conclusion)
    if (premises.length === 0) continue
    const key = chainKey(premises, conclusion)
    const existing = chainByKey.get(key)
    if (existing) {
      if (!existing.provenance.some((pt) => pt.source === source)) existing.provenance.push({ source })
      continue
    }
    const id = `c-${createHash("sha256").update(key).digest("hex").slice(0, 10)}`
    const created = { id, premises, conclusion, provenance: [{ source }], createdAt: now }
    g.chains.push(created)
    chainByKey.set(key, created)
    stats.chains++
  }

  const kept = simplifyChains(g.chains)
  stats.droppedChains = g.chains.length - kept.length
  g.chains = kept
  return { graph: g, stats }
}

/**
 * Strip redundant derivations, per conclusion, greedy in (premise count,
 * createdAt, key) order — the leanest, earliest derivation stands:
 *   • fewest-premises: a chain whose premises contain a kept chain's premises
 *   • ancestry-cover: a chain whose every premise is a kept chain's premise or
 *     derivable behind one — [A,B]⟹X plus [X,C]⟹Y makes [A,B,C]⟹Y redundant.
 */
export function simplifyChains(chains) {
  if (chains.length < 2) return chains
  const premisesOf = new Map()
  for (const c of chains) premisesOf.set(c.conclusion, [...(premisesOf.get(c.conclusion) ?? []), c.premises])

  const memo = new Map()
  const ancestry = (id, visiting = new Set()) => {
    if (memo.has(id)) return memo.get(id)
    const out = new Set()
    if (visiting.has(id)) return out
    visiting.add(id)
    for (const premises of premisesOf.get(id) ?? []) {
      for (const p of premises) {
        out.add(p)
        for (const a of ancestry(p, visiting)) out.add(a)
      }
    }
    visiting.delete(id)
    memo.set(id, out)
    return out
  }

  const byConclusion = new Map()
  for (const c of chains) byConclusion.set(c.conclusion, [...(byConclusion.get(c.conclusion) ?? []), c])
  const dropped = new Set()
  for (const candidates of byConclusion.values()) {
    candidates.sort(
      (a, b) =>
        a.premises.length - b.premises.length ||
        a.createdAt.localeCompare(b.createdAt) ||
        chainKey(a.premises, a.conclusion).localeCompare(chainKey(b.premises, b.conclusion)),
    )
    const kept = []
    for (const c of candidates) {
      const set = new Set(c.premises)
      const redundant = kept.some((k) => {
        if (k.premises.every((p) => set.has(p))) return true
        const covered = new Set(k.premises)
        for (const p of k.premises) for (const a of ancestry(p)) covered.add(a)
        return c.premises.every((p) => covered.has(p))
      })
      if (redundant) dropped.add(c)
      else kept.push(c)
    }
  }
  return chains.filter((c) => !dropped.has(c))
}

// ── coverage: which source lines are already extracted ──────────────────────

const hashLines = (lines) => createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16)
const splitLines = (text) => String(text).replace(/\r\n/g, "\n").split("\n")

/** The coverage record after extracting `text` through line index `through` (exclusive). */
export function coverageAt(text, through) {
  const lines = splitLines(text)
  const line = Math.min(through, lines.length)
  return { line, prefixHash: hashLines(lines.slice(0, line)) }
}

/**
 * Not-yet-extracted stretches of one source. Logs are append-only, so the
 * covered prefix is skipped while its hash still matches; a changed prefix
 * (the file was edited) restarts from the top — re-extraction is safe because
 * the auditor links re-found ideas to their existing nodes.
 *
 * Stretches break at blank lines and stay under `maxChars` where possible.
 * Line indices are 0-based, `to` exclusive.
 */
export function pendingStretches(source, text, coverage, maxChars = 16000) {
  const lines = splitLines(text)
  const prior = coverage?.[source]
  let from = 0
  if (prior && prior.line <= lines.length && hashLines(lines.slice(0, prior.line)) === prior.prefixHash) from = prior.line
  while (from < lines.length && !lines[from].trim()) from++
  let end = lines.length
  while (end > from && !lines[end - 1].trim()) end--
  if (from >= end) return []

  const stretches = []
  let start = from
  let size = 0
  let lastBreak = -1
  for (let i = from; i < end; i++) {
    size += lines[i].length + 1
    if (!lines[i].trim()) lastBreak = i
    if (size > maxChars && lastBreak > start) {
      stretches.push({ source, from: start, to: lastBreak })
      start = lastBreak + 1
      size = lines.slice(start, i + 1).reduce((n, l) => n + l.length + 1, 0)
      lastBreak = -1
    }
  }
  stretches.push({ source, from: start, to: end })
  return stretches
}

// ── views (for the extractor, the auditor, the prober) ──────────────────────

const fromSource = (node, source) => node.provenance.some((pt) => pt.source === source)
const chainLine = (c) => `- ${c.premises.join(" + ")} ⟹ ${c.conclusion}`

/** THE GRAPH SO FAR for one source: its ideas and the chains among them, ids verbatim. */
export function digest(graph, source) {
  const nodes = graph.nodes.filter((n) => fromSource(n, source))
  if (nodes.length === 0) return "(nothing extracted from this source yet)"
  const ids = new Set(nodes.map((n) => n.id))
  const chains = graph.chains.filter((c) => ids.has(c.conclusion) || c.premises.some((p) => ids.has(p)))
  return [
    "## Ideas",
    ...nodes.map((n) => `- ${n.id} — ${n.name}: ${n.statement}`),
    "",
    "## Chains",
    ...(chains.length ? chains.map(chainLine) : ["(none)"]),
  ].join("\n")
}

export function listNodes(graph, { source } = {}) {
  const nodes = source ? graph.nodes.filter((n) => fromSource(n, source)) : graph.nodes
  if (nodes.length === 0) return "(no ideas)"
  return nodes
    .map((n) => {
      const extra = [...n.aliases, ...n.phrasings]
      return `- ${n.id} — ${n.name}: ${n.statement}${extra.length ? `\n  also: ${extra.join(" | ")}` : ""}`
    })
    .join("\n")
}

export function listSources(graph) {
  const counts = new Map()
  for (const n of graph.nodes) for (const s of new Set(n.provenance.map((pt) => pt.source))) counts.set(s, (counts.get(s) ?? 0) + 1)
  if (counts.size === 0) return "(the graph is empty)"
  return [...counts].map(([s, n]) => `- ${s} — ${n} idea${n === 1 ? "" : "s"}`).join("\n")
}

// ── Obsidian notes ──────────────────────────────────────────────────────────

const yamlString = (s) => JSON.stringify(String(s))

function sourceLink(source) {
  const path = source.replace(/\.md$/i, "")
  const parts = path.split("/")
  const label = parts.length >= 2 ? parts.slice(-2).join(" · ") : path
  return `[[${path}|${label}]]`
}

/** One note per idea: statement, "Follows from" (one bullet per chain), "Leads to", sources. */
export function renderNote(graph, node) {
  const name = (id) => graph.nodes.find((n) => n.id === id)?.name ?? id
  const link = (id) => `[[${id}|${name(id)}]]`
  const from = graph.chains.filter((c) => c.conclusion === node.id)
  const to = [...new Set(graph.chains.filter((c) => c.premises.includes(node.id)).map((c) => c.conclusion))]
  const sources = []
  for (const pt of node.provenance) {
    const line = `- ${sourceLink(pt.source)}${pt.line ? ` · line ${pt.line}` : ""}`
    if (!sources.includes(line)) sources.push(line)
  }

  const out = [
    "---",
    `id: ${node.id}`,
    `aliases: [${[node.name, ...node.aliases].map(yamlString).join(", ")}]`,
    "tags: [graph]",
    "generated: true # rewritten by /extract — edits here are overwritten",
    "---",
    `# ${node.name}`,
    "",
    node.statement,
  ]
  if (from.length) out.push("", "## Follows from", ...from.map((c) => `- ${c.premises.map(link).join(" + ")}`))
  if (to.length) out.push("", "## Leads to", ...to.map((id) => `- ${link(id)}`))
  if (node.phrasings.length) out.push("", "## Also phrased as", ...node.phrasings.map((p) => `- ${p}`))
  out.push("", "## Sources", ...sources)
  return out.join("\n") + "\n"
}

/** Every note, keyed by filename. */
export function renderAll(graph) {
  return new Map(graph.nodes.map((n) => [`${n.id}.md`, renderNote(graph, n)]))
}
