import assert from "node:assert/strict"
import { test } from "node:test"
import {
  coverageAt,
  digest,
  emptyGraph,
  mergeFindings,
  pendingStretches,
  renderNote,
  simplifyChains,
  slugify,
  validateFindings,
} from "../lib/graph-core.mjs"

const NOW = "2026-10-23T00:00:00.000Z"
const SRC = "lessons/calc/log.md"

const findings = {
  propositions: [
    { id: "p1", name: "Derivative", statement: "The derivative is the limit of difference quotients.", line: 12 },
    { id: "p2", name: "Chain rule", statement: "(f∘g)' = (f'∘g)·g'.", aliases: ["composition rule"] },
  ],
  chains: [{ premises: ["p1"], conclusion: "p2" }],
}

test("slugify makes kebab ids and never returns empty", () => {
  assert.equal(slugify("Will to Power"), "will-to-power")
  assert.equal(slugify("Café — théorie"), "cafe-theorie")
  assert.equal(slugify("∑∫"), "idea")
})

test("validateFindings enforces the chain laws", () => {
  const ids = new Set(["existing"])
  assert.equal(validateFindings(findings, ids), null)
  assert.match(validateFindings({ propositions: [] }, ids), /both fields/)
  assert.match(validateFindings({ ...findings, chains: [{ premises: [], conclusion: "p2" }] }, ids), /at least one/)
  assert.match(validateFindings({ ...findings, chains: [{ premises: ["p9"], conclusion: "p2" }] }, ids), /"p9"/)
  assert.match(validateFindings({ ...findings, chains: [{ premises: ["p2"], conclusion: "p2" }] }, ids), /both a premise/)
  assert.equal(validateFindings({ ...findings, chains: [{ premises: ["existing"], conclusion: "p2" }] }, ids), null)
})

test("merge creates nodes with slug ids, provenance and chains", () => {
  const { graph, stats } = mergeFindings(emptyGraph(), findings, { links: [] }, { source: SRC, now: NOW })
  assert.deepEqual(stats, { nodes: 2, linked: 0, chains: 1, droppedChains: 0 })
  assert.deepEqual(graph.nodes.map((n) => n.id), ["derivative", "chain-rule"])
  assert.deepEqual(graph.nodes[0].provenance, [{ source: SRC, line: 12 }])
  assert.deepEqual(graph.chains[0].premises, ["derivative"])
  assert.equal(graph.chains[0].conclusion, "chain-rule")
})

test("a link verdict merges phrasings and provenance into the existing node", () => {
  const first = mergeFindings(emptyGraph(), findings, { links: [] }, { source: SRC, now: NOW }).graph
  const again = {
    propositions: [{ id: "p1", name: "Composition rule", statement: "Differentiating a composition multiplies derivatives." }],
    chains: [{ premises: ["derivative"], conclusion: "p1" }],
  }
  const { graph, stats } = mergeFindings(first, again, { links: [{ id: "p1", linkTo: "chain-rule" }] }, { source: "notes/n.md", now: NOW })
  assert.equal(stats.nodes, 0)
  assert.equal(stats.linked, 1)
  assert.equal(stats.chains, 0, "the same argument restated only gains provenance")
  const node = graph.nodes.find((n) => n.id === "chain-rule")
  assert.equal(node.name, "Chain rule", "the name never changes after creation")
  assert.ok(node.aliases.includes("Composition rule"))
  assert.deepEqual(node.phrasings, ["Differentiating a composition multiplies derivatives."])
  assert.deepEqual(node.provenance.map((p) => p.source), [SRC, "notes/n.md"])
  assert.deepEqual(graph.chains[0].provenance.map((p) => p.source), [SRC, "notes/n.md"])
  assert.equal(first.nodes.find((n) => n.id === "chain-rule").phrasings.length, 0, "input graph is not mutated")
})

test("same name, distinct idea gets a suffixed id", () => {
  const first = mergeFindings(emptyGraph(), findings, { links: [] }, { source: SRC, now: NOW }).graph
  const twin = { propositions: [{ id: "p1", name: "Chain rule", statement: "In probability, P(A∩B) = P(A|B)P(B)." }], chains: [] }
  const { graph } = mergeFindings(first, twin, { links: [] }, { source: SRC, now: NOW })
  assert.ok(graph.nodes.some((n) => n.id === "chain-rule-2"))
})

test("simplifyChains: fewest premises wins", () => {
  const chains = [
    { premises: ["a", "b"], conclusion: "x", createdAt: NOW },
    { premises: ["a"], conclusion: "x", createdAt: NOW },
  ]
  assert.deepEqual(simplifyChains(chains).map((c) => c.premises), [["a"]])
})

test("simplifyChains: ancestry cover drops the flattened derivation", () => {
  const chains = [
    { premises: ["a", "b"], conclusion: "x", createdAt: NOW },
    { premises: ["x", "c"], conclusion: "y", createdAt: NOW },
    { premises: ["a", "b", "c"], conclusion: "y", createdAt: "2026-10-24T00:00:00.000Z" },
  ]
  const kept = simplifyChains(chains)
  assert.equal(kept.length, 2)
  assert.ok(!kept.some((c) => c.premises.length === 3))
})

test("simplifyChains keeps genuinely independent arguments", () => {
  const chains = [
    { premises: ["a"], conclusion: "x", createdAt: NOW },
    { premises: ["b"], conclusion: "x", createdAt: NOW },
  ]
  assert.equal(simplifyChains(chains).length, 2)
})

test("renderNote writes aliases, Follows from, Leads to and source wikilinks", () => {
  const { graph } = mergeFindings(emptyGraph(), findings, { links: [] }, { source: SRC, now: NOW })
  const chain = renderNote(graph, graph.nodes.find((n) => n.id === "chain-rule"))
  assert.match(chain, /^aliases: \["Chain rule", "composition rule"\]$/m)
  assert.match(chain, /## Follows from\n- \[\[derivative\|Derivative\]\]/)
  assert.match(chain, /\[\[lessons\/calc\/log\|calc · log\]\]/)
  const deriv = renderNote(graph, graph.nodes.find((n) => n.id === "derivative"))
  assert.match(deriv, /## Leads to\n- \[\[chain-rule\|Chain rule\]\]/)
  assert.match(deriv, /· line 12/)
})

test("digest lists a source's ideas and chains with ids verbatim", () => {
  const { graph } = mergeFindings(emptyGraph(), findings, { links: [] }, { source: SRC, now: NOW })
  const d = digest(graph, SRC)
  assert.match(d, /- derivative — Derivative:/)
  assert.match(d, /- derivative ⟹ chain-rule/)
  assert.match(digest(graph, "other.md"), /nothing extracted/)
})

test("pendingStretches skips the covered prefix and restarts when it changed", () => {
  const text = "a\n\nb\n\nc"
  assert.deepEqual(pendingStretches(SRC, text, {}), [{ source: SRC, from: 0, to: 5 }])
  const coverage = { [SRC]: coverageAt(text, 3) }
  assert.deepEqual(pendingStretches(SRC, text + "\n\nd", coverage), [{ source: SRC, from: 4, to: 7 }])
  assert.deepEqual(pendingStretches(SRC, "a", { [SRC]: coverageAt("a", 1) }), [])
  assert.deepEqual(pendingStretches(SRC, "EDITED\n\nb\n\nc", coverage)[0].from, 0)
})

test("pendingStretches splits long text at blank lines", () => {
  const para = "x".repeat(60)
  const text = Array.from({ length: 10 }, () => para).join("\n\n")
  const stretches = pendingStretches(SRC, text, {}, 150)
  assert.ok(stretches.length > 1)
  for (let i = 1; i < stretches.length; i++) assert.equal(stretches[i].from, stretches[i - 1].to + 1)
  assert.equal(stretches.at(-1).to, 19)
})
