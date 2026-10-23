import assert from "node:assert/strict"
import { test } from "node:test"
import { planSlugs, restylePlan } from "../lib/plan.mjs"

const PLAN = `---
lesson: calc
goal: chain-rule
current:
visited: []
---
# Plan — derivatives

Approach prose.

\`\`\`mermaid
graph TD
  limits["Limits"]
  derivative["Derivative = limit of slopes"]
  chain-rule["Chain rule"]
  limits --> derivative
  derivative --> chain-rule
\`\`\`
`

test("planSlugs reads declarations and edges, not keywords", () => {
  assert.deepEqual(planSlugs(PLAN).sort(), ["chain-rule", "derivative", "limits"])
  assert.deepEqual(planSlugs("no diagram"), [])
})

test("restylePlan marks the current node and remembers visited ones", () => {
  const one = restylePlan(PLAN, "limits")
  assert.equal(one.known, true)
  assert.match(one.text, /^current: limits$/m)
  assert.match(one.text, /class limits current/)

  const two = restylePlan(one.text, "derivative")
  assert.match(two.text, /^current: derivative$/m)
  assert.match(two.text, /^visited: \[limits\]$/m)
  assert.match(two.text, /class limits visited/)
  assert.match(two.text, /class derivative current/)
  assert.equal((two.text.match(/%% status/g) ?? []).length, 1, "status block is replaced, not stacked")
  assert.equal(planSlugs(two.text).length, 3, "status lines are not read as nodes")
})

test("going back to a visited node keeps it current, not visited", () => {
  let t = restylePlan(PLAN, "limits").text
  t = restylePlan(t, "derivative").text
  t = restylePlan(t, "limits").text
  assert.match(t, /^current: limits$/m)
  assert.match(t, /^visited: \[limits, derivative\]$/m)
  assert.match(t, /class derivative visited/)
  assert.doesNotMatch(t, /class limits,derivative visited/)
})

test("an unknown slug leaves the plan untouched", () => {
  const r = restylePlan(PLAN, "integrals")
  assert.equal(r.known, false)
  assert.equal(r.text, PLAN)
})
