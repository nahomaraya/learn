#!/usr/bin/env node
/**
 * graph — the knowledge-graph store behind /extract, /import-notes and the
 * prober's map reads. The extractor and auditor subagents do the judgement;
 * this script does every deterministic part (coverage, validation, merge,
 * chain simplification, note rendering). See lib/graph-core.mjs for the model.
 *
 *   node graph.mjs pending [notes.md ...]   stretches not yet extracted (JSON lines):
 *                                           every lessons/<slug>/log.md, plus any notes files given
 *   node graph.mjs digest --source <path>   THE GRAPH SO FAR for one source (for the extractor)
 *   node graph.mjs list [--source <path>]   every idea, or one source's (for the auditor / prober)
 *   node graph.mjs sources                  every source and its idea count
 *   node graph.mjs merge --source <path> --findings <f.json> --verdicts <v.json> --through <line>
 *                                           validate + merge + simplify + re-render; exits 1 with
 *                                           the problem (nothing written) when findings are invalid
 *   node graph.mjs render                   re-render every graph/<id>.md from the store
 *
 * Paths are vault-relative (`lessons/x/log.md`); absolute paths are accepted
 * and normalised.
 */

import { readdirSync } from "node:fs"
import { isAbsolute, relative } from "node:path"
import { PROJECT_ROOT, existsSync, join, mkdirSync, parseArgs, readFileSync, writeFileSync } from "./_common.mjs"
import {
  coverageAt,
  digest,
  emptyGraph,
  listNodes,
  listSources,
  mergeFindings,
  pendingStretches,
  renderAll,
  validateFindings,
  validateVerdicts,
} from "./lib/graph-core.mjs"

const GRAPH_DIR = join(PROJECT_ROOT, "graph")
const STORE = join(GRAPH_DIR, ".graph.json")

function load() {
  try {
    return { ...emptyGraph(), ...JSON.parse(readFileSync(STORE, "utf8")) }
  } catch {
    return emptyGraph()
  }
}

function save(graph) {
  mkdirSync(GRAPH_DIR, { recursive: true })
  writeFileSync(STORE, JSON.stringify(graph, null, 2) + "\n", "utf8")
  for (const [file, text] of renderAll(graph)) writeFileSync(join(GRAPH_DIR, file), text, "utf8")
}

/** Vault-relative, forward slashes. */
function sourceOf(path) {
  const raw = String(path).replace(/^["']|["']$/g, "")
  const abs = isAbsolute(raw) ? raw : join(PROJECT_ROOT, raw)
  const rel = relative(PROJECT_ROOT, abs)
  return (rel.startsWith("..") || isAbsolute(rel) ? abs : rel).replace(/\\/g, "/")
}

const absOf = (source) => (isAbsolute(source) ? source : join(PROJECT_ROOT, source))

function lessonLogs() {
  const dir = join(PROJECT_ROOT, "lessons")
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(dir, d.name, "log.md")))
    .map((d) => `lessons/${d.name}/log.md`)
}

function readJson(path, what) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch (e) {
    throw new Error(`${what}: cannot read JSON from ${path} (${e.message})`)
  }
}

const commands = {
  pending(args, positional) {
    const graph = load()
    const sources = [...lessonLogs(), ...positional.map(sourceOf)]
    let any = false
    for (const source of [...new Set(sources)]) {
      const path = absOf(source)
      if (!existsSync(path)) {
        console.log(JSON.stringify({ source, error: "file not found" }))
        continue
      }
      for (const s of pendingStretches(source, readFileSync(path, "utf8"), graph.coverage)) {
        any = true
        // offset/limit are ready for the Read tool (1-based offset); `through` goes to merge.
        console.log(JSON.stringify({ source, offset: s.from + 1, limit: s.to - s.from, through: s.to }))
      }
    }
    if (!any) console.log("(nothing pending)")
  },

  digest(args) {
    if (!args.source) throw new Error("digest needs --source <path>")
    console.log(digest(load(), sourceOf(args.source)))
  },

  list(args) {
    console.log(listNodes(load(), { source: args.source ? sourceOf(args.source) : undefined }))
  },

  sources() {
    console.log(listSources(load()))
  },

  merge(args) {
    for (const k of ["source", "findings", "verdicts", "through"]) if (!args[k]) throw new Error(`merge needs --${k}`)
    const graph = load()
    const source = sourceOf(args.source)
    const findings = readJson(args.findings, "findings")
    const verdicts = readJson(args.verdicts, "verdicts")
    const problem =
      validateFindings(findings, new Set(graph.nodes.map((n) => n.id))) ?? validateVerdicts(verdicts)
    if (problem) {
      console.log(`INVALID: ${problem}`)
      return 1
    }
    const { graph: next, stats } = mergeFindings(graph, findings, verdicts, { source })
    next.coverage[source] = coverageAt(readFileSync(absOf(source), "utf8"), Number(args.through))
    save(next)
    console.log(
      `merged ${source}: ${stats.nodes} new idea(s), ${stats.linked} linked, ${stats.chains} new chain(s), ${stats.droppedChains} redundant chain(s) dropped — graph now ${next.nodes.length} ideas`,
    )
    return 0
  },

  render() {
    const graph = load()
    save(graph)
    console.log(`rendered ${graph.nodes.length} note(s) into ${GRAPH_DIR}`)
  },
}

const [cmd, ...rest] = process.argv.slice(2)
const positional = []
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith("--")) {
    if (rest[i + 1] !== undefined && !rest[i + 1].startsWith("--")) i++
  } else positional.push(rest[i])
}

if (!commands[cmd]) {
  console.log("usage: graph.mjs pending [notes...] | digest --source p | list [--source p] | sources | merge ... | render")
  process.exit(1)
}
try {
  process.exit(commands[cmd](parseArgs(rest), positional) ?? 0)
} catch (e) {
  console.log(`ERROR: ${e.message}`)
  process.exit(1)
}
