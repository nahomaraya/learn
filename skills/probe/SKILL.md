---
name: probe
description: Measure what the learner already knows about a topic and what they actually want from it, before any teaching — a binary search for the edge of their understanding on every strand the goal depends on. Writes lessons/<slug>/assessment.md. Use when starting a new lesson (/teach runs it automatically), or when they want to know where they stand on a topic without being taught yet.
argument-hint: <topic>
---

# The probe

**First, read** `.claude/doctrine/core.md`, `.claude/doctrine/questions.md` and `.claude/doctrine/vault.md`. They are part of these instructions.

Your whole job is two measurements: **what they need to learn** (their goal — non-graded questions) and **what they already know** (a detailed map of their exact understanding — `Probe` questions). The whole lesson will be planned from your map; it must be precise. You do not teach here, and you do not plan.

Work strictly one question at a time: ask, read the answer, grade it, then choose the next question from what it told you.

## 0. Open the lesson

1. Slug the topic. `Glob` `lessons/*/assessment.md`; if a lesson on this topic exists, use it:
   - `phase: probe` → this is a resumed probe. Read its `log.md` (the tail, or more if needed) to recover what's already measured, and continue from there.
   - any later phase → the probe is done; tell them in one line and hand over to `/teach <slug>` (follow `.claude/skills/teach/SKILL.md`).
2. New lesson: create `lessons/<slug>/assessment.md` with the frontmatter only (`phase: probe`, `topic`, `started`, `last_session`; `goal` blank).
3. Link the log: `node .claude/scripts/md-log.mjs --link lessons/<slug>/log.md`.

## 1. Read their persistent map

`node .claude/scripts/graph.mjs sources`, then `list --source` for any source near this topic (or `Grep` `graph/` for its key terms). Glance at related lessons' `assessment.md` too. What they were taught before tells you where to *start* strands — never what to skip unchecked. A strand the map says they hold still gets one high question to confirm it. Empty graph → just probe.

## 2. Make the goal concrete — non-graded

"I want to understand LLMs" can mean ten different things; which one changes everything. Interrogate until it's concrete. Questions, not orientation: if they don't know the terrain, record that the goal starts with orientation — never draw the map yourself. Write the settled goal into the frontmatter `goal` as soon as you have it.

## 3. Reason out the strands

From the goal, what will the lesson depend on? To teach them this, where would the teaching start, and what must it build on? Each dependency is a strand — bounded by relevance to the goal, nothing more.

## 4. Binary-search every strand — `Probe` questions

The edge of a strand is found by bracketing: something they reliably get **right** (a floor) and something they get **wrong** or don't know (a ceiling). Choose every next question from the evidence — the verdict, their confidence, and their own words together set where the next question should sit. Narrow the bracket one question at a time:

- **Enter near the top, not the bottom.** Their goal and how they talk calibrate the strand: an adult reaching for advanced material almost always holds the school-level basics — open near the hardest thing the goal needs and let a miss walk you down. Opening a strand at textbook basics to "warm up" wastes the question that could have moved an edge.
- **Strands inform each other.** A strand crushed at height says its neighbors start high too — never open below what the session has already demonstrated.
- **Correct + confident** → jump the difficulty up sharply — the bigger the jump, the fewer the questions.
- **Correct but hesitant** (low confidence, thin reasoning) → fragile: step up gently and characterize the shakiness.
- **Wrong** → the ceiling drops; narrow back in to pin exactly where it sits.
- **A miss is one coordinate, not a verdict** — slip, gap, or misconception look identical. Probe around it. Misconceptions matter most: a confidently-held wrong model has to be dislodged, not topped up, so dig into its extent before moving on.
- **A strand that never breaks is not done** — escalate until it does. A run of right answers is a floor with no ceiling.

Every question should move an edge somewhere — no filler, no re-asking what their last answer showed, never descending into already-bracketed territory. Every wasted question is resolution the final map doesn't get; the questions you save are what let you ask the specific, nuanced ones that actually locate the edge.

Grade each answer in one or two lines and move on — the probe is measurement, not teaching. A misconception you uncover is recorded, not repaired (the plan will build the repair in); name it plainly so they know, then keep measuring.

**Grounding — their material, not their description of it.** If they reference a file, read it yourself; PDFs go to `pdf-reader`; `researcher` sparingly — probing is measurement, not exploration.

## 5. Conclude — write the assessment

When every strand is bracketed and the goal is concrete, write the body of `assessment.md` exactly in the shape `vault.md` gives: one entry per strand — floor, ceiling, misconceptions, build from — written from the evidence, plus the summary and any open doubts. Set `phase: plan`.

Then one short closing line in chat. If `/teach` invoked you, continue straight into its planning step. If they ran `/probe` on its own, stop: say the assessment is in `lessons/<slug>/assessment.md` and that `/teach <slug>` picks up from it.
