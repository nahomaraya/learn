import assert from "node:assert/strict"
import { test } from "node:test"
import { answerCallouts, questionCallout, roleOf, splitNodeTag } from "../lib/md-format.mjs"

const check = {
  header: "Check",
  question: "What is $(x^3)'$? [node: power-rule]",
  options: [{ label: "$3x^2$" }, { label: "$x^2$" }, { label: "$3x$" }, { label: "I don't know" }],
}
const confidence = { header: "Confidence", question: "How sure are you?", options: [{ label: "75%" }] }

test("roles come from the header", () => {
  assert.equal(roleOf({ header: "Predict" }), "Predict")
  assert.equal(roleOf({ header: "quiz" }), "Quiz")
  assert.equal(roleOf({ header: "Confidence" }), "Confidence")
  assert.equal(roleOf({ header: "Pace" }), null)
})

test("the node tag is stripped from the text and shown in the title", () => {
  assert.deepEqual(splitNodeTag("Q? [node: Power-Rule] "), { text: "Q?", node: "power-rule" })
  const block = questionCallout(check)
  assert.match(block, /^> \[!question\] Check — power-rule$/m)
  assert.doesNotMatch(block, /\[node:/)
  assert.match(block, /^> 4\. I don't know$/m)
})

test("the confidence companion is not rendered as its own question", () => {
  assert.equal(questionCallout(confidence), null)
})

test("confidence folds into the graded answer line", () => {
  const [block, ...rest] = answerCallouts([check, confidence], { [check.question]: "$3x^2$", [confidence.question]: "75%" })
  assert.equal(rest.length, 0)
  assert.match(block, /^> \[!example\] Check — power-rule — answered$/m)
  assert.match(block, /^> Your answer: \$3x\^2\$ · confidence 75%$/m)
})

test("I don't know is its own signal and drops the confidence", () => {
  const [block] = answerCallouts([check, confidence], { [check.question]: "I don't know", [confidence.question]: "25%" })
  assert.match(block, /\[!question\] Check — power-rule — I don't know/)
  assert.doesNotMatch(block, /confidence/)
})

test("non-graded answers stay plain", () => {
  const ask = { header: "Pace", question: "Faster or slower?" }
  assert.deepEqual(answerCallouts([ask], { [ask.question]: "Faster" }), ["> [!example] Answer\n> Faster"])
  assert.match(answerCallouts([ask], {})[0], /no answer/)
})
