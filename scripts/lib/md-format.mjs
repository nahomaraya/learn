/**
 * Obsidian formatting for the md-log hook — pure functions, so they can be
 * tested without a transcript.
 *
 * Question/answer blocks are fully quoted callouts. User and assistant blocks
 * are a callout HEADER followed by UNQUOTED text — deliberate, and the same
 * trick the pi extension used: lesson prose has to render as normal markdown so
 * that $LaTeX$, mermaid fences and ![[image]] embeds actually render.
 *
 * Question roles ride the AskUserQuestion `header` (12-char cap, so short):
 *   Probe | Predict | Check — graded (the agent holds the answer and grades
 *                             in its next message). `Quiz` is the legacy name.
 *   Confidence              — the companion question in the same call; never
 *                             rendered on its own, folded into the answer line.
 *   anything else           — a non-graded ask_user_question.
 *
 * A teach-phase question names its plan node with a trailing tag in the
 * question text: `... [node: chain-rule]`. The tag is stripped from the log
 * and shown in the callout title instead.
 */

const GRADED = /^(probe|predict|check|quiz)\b/i
const CONFIDENCE = /^confidence\b/i
const NODE_TAG = /\s*\[node:\s*([a-z0-9_-]+)\s*\]\s*$/i

export const roleOf = (q) => {
  const header = String(q?.header ?? "").trim()
  const m = GRADED.exec(header)
  if (m) return m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()
  if (CONFIDENCE.test(header)) return "Confidence"
  return null
}

export const isGraded = (q) => {
  const role = roleOf(q)
  return role !== null && role !== "Confidence"
}

export const isConfidence = (q) => roleOf(q) === "Confidence"

/** `{ text, node }` — the question text without its node tag, and the tag. */
export function splitNodeTag(question) {
  const text = String(question ?? "")
  const m = NODE_TAG.exec(text)
  return m ? { text: text.slice(0, m.index), node: m[1].toLowerCase() } : { text, node: null }
}

export const isDontKnow = (answer) => /^i\s*don.?t\s*know$/i.test(String(answer ?? "").trim())

export function callout(type, title, bodyLines) {
  const lines = [`> [!${type}] ${title}`]
  for (const line of bodyLines) lines.push(line.length === 0 ? ">" : `> ${line}`)
  return lines.join("\n")
}

export const userBlock = (text) => `> [!quote] YOU\n\n${text}`
export const assistantBlock = (text) => `> [!abstract] CLAUDE\n\n${text}`

function title(q) {
  const role = roleOf(q)
  const { node } = splitNodeTag(q.question)
  if (role && role !== "Confidence") return node ? `${role} — ${node}` : role
  const header = String(q.header ?? "").trim()
  return header ? `Question — ${header}` : "Question"
}

/** The question block, or null for a Confidence companion (folded into the answer). */
export function questionCallout(q) {
  if (isConfidence(q)) return null
  const body = splitNodeTag(q.question).text.split("\n")
  const options = Array.isArray(q.options) ? q.options : []
  if (options.length > 0) {
    body.push("")
    options.forEach((o, i) => body.push(`${i + 1}. ${o.label}`))
  }
  return callout("question", title(q), body)
}

const picked = (answer) => (Array.isArray(answer) ? answer.join(", ") : String(answer ?? ""))

/**
 * Answer blocks for one AskUserQuestion call. A Confidence question is folded
 * into the graded answer it accompanies (the one before it), so the log reads
 * "Your answer: X · confidence 75%".
 */
export function answerCallouts(questions, answers) {
  const out = []
  let lastGraded = null
  for (const q of questions) {
    const answer = picked(answers?.[q.question])
    if (isConfidence(q)) {
      if (lastGraded && answer && !lastGraded.dontKnow) lastGraded.lines[0] += ` · confidence ${answer}`
      continue
    }
    const t = title(q)
    if (!answer) {
      out.push({ type: "warning", title: `${t} — no answer`, lines: ["(skipped)"] })
      lastGraded = null
      continue
    }
    if (isGraded(q)) {
      // "I don't know" is a distinct signal, not a wrong answer — never styled as a failure.
      const dontKnow = isDontKnow(answer)
      lastGraded = {
        type: dontKnow ? "question" : "example",
        title: dontKnow ? `${t} — I don't know` : `${t} — answered`,
        lines: [`Your answer: ${answer}`],
        dontKnow,
      }
      out.push(lastGraded)
    } else {
      out.push({ type: "example", title: "Answer", lines: [answer] })
      lastGraded = null
    }
  }
  return out.map((b) => callout(b.type, b.title, b.lines))
}

/** Strip harness-injected scaffolding so the log reads as the lesson, not the plumbing. */
export function cleanUserText(text) {
  return String(text)
    .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, "")
    .replace(/<local-command-stdout>[\s\S]*?<\/local-command-stdout>/g, "")
    .replace(/<local-command-stderr>[\s\S]*?<\/local-command-stderr>/g, "")
    .replace(/<local-command-caveat>[\s\S]*?<\/local-command-caveat>/g, "")
    .replace(/<command-name>[\s\S]*?<\/command-name>/g, "")
    .replace(/<command-message>[\s\S]*?<\/command-message>/g, "")
    .replace(/<command-args>[\s\S]*?<\/command-args>/g, "")
    .replace(/<skill\b([^>]*)>[\s\S]*?<\/skill>/g, (_m, attrs) => {
      const name = /name="([^"]+)"/.exec(attrs)?.[1]
      return `> [!note] SKILL loaded: ${name ?? "(unknown)"}`
    })
    .trim()
}
