---
name: teach
description: Run a lesson — probe what the learner knows, plan the minimal dependency tree to their goal, then teach it one reasoning step at a time with predict → teach → check, so it is understood rather than memorized. Starts a new lesson or resumes one from its vault files. Use whenever they want to learn or be taught a topic; for a quick one-off explanation, apply .claude/doctrine/method.md without the lesson ceremony.
argument-hint: "[topic | lesson-slug]"
---

# Teach

**First, read** `.claude/doctrine/core.md`, `.claude/doctrine/method.md`, `.claude/doctrine/questions.md` and `.claude/doctrine/vault.md`. They are part of these instructions.

A lesson is **probe → plan → teach**, and it lives in `lessons/<slug>/`. A lesson can span many Claude Code sessions; its files are its memory.

## 0. Find the lesson

- **No argument** → `Grep` `^phase:` across `lessons/*/assessment.md`. List the unfinished lessons (phase ≠ `done`) with their topic and `last_session`, and ask which to continue — or a new topic. No lessons yet → ask what they want to learn.
- **An argument** → match it against existing lesson slugs and topics. No match → a new lesson.

Then branch on the lesson's `phase`:

| State | Do |
|---|---|
| no lesson folder | run the probe — follow `.claude/skills/probe/SKILL.md` — then continue to §2 |
| `phase: probe` | resume the probe (the probe skill handles it), then §2 |
| `phase: plan` | link the log; read `assessment.md`; if `plan.md` exists and was presented, ask whether it still stands; else §2 |
| `phase: teach` | **resume** — §1 |
| `phase: done` | say so in one line; offer a follow-on lesson that extends the goal, a review, or `/practice` |

## 1. Resuming a lesson

1. Link the log: `node .claude/scripts/md-log.mjs --link lessons/<slug>/log.md`.
2. Read `assessment.md`, `plan.md` (its `current` and `visited` are where they are), and the tail of `log.md` — enough to recover the last few steps: what was taught, what they missed, any open question, any commitment you made. Check `graph.mjs sources` for ideas added since `last_session` (other lessons, imported notes).
3. **Re-check before you continue.** Open with a short recap *question*, not a summary: a `Check` on the current node (or the last visited one). If the gap since `last_session` is long, or the log shows misses near the current node, first re-check the visited nodes the current one depends on — a short run of checks walking back along the plan's edges until one holds. What doesn't hold is repaired before anything new is built.
4. Update `last_session`, then carry on with §4.

## 2. Plan — think hard here

This is the highest-leverage step; don't rush it. With their level and goal in hand (`assessment.md`), reason out the best way to teach *this thing* to *this person*. Re-read the method and plan against it:

- Scope the field from your own knowledge: its core concepts, the real first principles, standard framings, common gotchas — and where your picture of the field is less than clear, dispatch a background `researcher` to check it. Planning is the natural moment for verification; a clear picture of the ideas is what the lesson stands on.
- What are the unconditional truths this rests on? Is there a clean atomic unit ("ALL X is done through {____}")?
- Which of those do they already hold (from the assessment)? Build from there — not below it, not above it. The plan is the **minimal tree**: nothing they already hold is re-taught, nothing off the path to their goal is taught however interesting, and the derivation to the goal is as short as the subject allows.
- What's the motivated discovery path from those truths to their goal? Where does each step come from — why would anyone reach for it?
- Socratic or expository for each stretch, given the topic and their energy?

**The plan map** is `lessons/<slug>/plan.md`, in exactly the format `vault.md` gives. It is a **map, not a syllabus**: nodes are structural landmarks — the unconditional truths at the bottom, the major stations, the goal at the sink — not turns of teaching. The reasoning step is the fine unit; one node may take one step or five. There is no size ceiling: as many nodes as the subject genuinely needs — elaborate is fine, wrong is not. What keeps a map readable isn't compression, it's correct structure. Slugs are permanent once chosen. Set the frontmatter `goal` to the sink's slug.

**Stress-test the roots before presenting.** For every node you treat as foundational: is it genuinely an unconditional truth *for them*, or a disguised theorem that derives from something simpler they'd accept at face value? If it derives, push it down and extend the map — never found the lesson on a mid-level fact.

**Present the plan — always, before any teaching.** Two parts in one message:

1. **The approach, in prose.** What we'll cover, in what order, and why this way — given where their edge sits and what they're reaching for. A few freeform sentences.
2. **The map**, embedded live: `![[lessons/<slug>/plan]]`. Obsidian renders the plan file inside the log, and the embed keeps tracking it as the hook marks their position. Never redraw the plan in prose — no second mermaid block, no outline restating what the map shows.

**Presenting ends your turn.** Ask them to confirm before teaching begins. Changes → revise `plan.md` and present again. On their go-ahead, set `phase: teach` in `assessment.md` and begin the first node. Never teach in the presenting turn.

## 3. The map moves with them

The map is a hypothesis about them, and the probe is only its first sketch — the revealing data arrives during teaching, in their own words. Measuring never stops: their understanding as actually expressed outranks whatever the plan assumed, and when they differ, the map moves — rewrite `plan.md` to restructure, add a foundation they turn out to lack, prune what they already hold, detour for a question worth exploring. Rewriting is normal. Keep existing slugs, keep the frontmatter's `current`/`visited`, drop the `%% status` block. Mid-lesson rewrites carry on without re-presenting; mention the change in a line. Update `assessment.md` too when a strand turns out different from what the probe recorded.

When the ground shifts mid-lesson — a missing foundation, a confusion deeper than the map assumed — **never rush the repair**: no wall of text that "covers" the missing ground in one turn to get back on plan. The plan serves their understanding, never the reverse. Build the missing ground the only way anything is built here — one reasoning step at a time, each landing and verified. Detours are not interruptions to get through; they are the teaching. A map that can't change is a wrong map.

**Position is the latest tagged node.** Every `Predict` and `Check` carries `[node: <slug>]` (questions doctrine); that is what moves the map. A tag is a position, not a verdict — nodes are never marked finished. Stay on one node for as many steps as the understanding needs, and move on by asking about the next one. Off-map questions are non-graded. If the hook reports an unknown slug, fix the tag or the plan.

## 4. Teach — one step at a time

The plan is the landscape; teaching is the road. You move them across it **one reasoning step at a time**: each step takes them from something they already hold as obviously true to the next fact, by a single motivated move — so the new fact doesn't merely follow, it *lands* as obviously true.

Every step is a **predict → teach → check** cycle:

**The prediction (`Predict`) — motivation.** Asked BEFORE you teach the step. Its subject is the NEXT step — not yet taught — so it need not be answerable from what's covered. Its shape is a nudge, not a test: point at the problem with the current state ("this works, but it can't survive X — what has to give?") and let them try to discover the next step themselves. Direct them toward the right territory; reveal nothing more. A prediction they can't fully attempt is fine — the attempt is the point. When it returns, OPEN the teaching by resolving it explicitly: what they predicted, what is actually true, and why — make the correction land on their attempt. Skip the prediction when there's no meaningful next step to anticipate (a wrap-up, a pure repair after a missed check) — your judgment, never a habit.

**The step.**
1. **One step, one fact.** Small enough to be fully understood at once. If it needs two explanations to land, it's two steps.
2. **Present it for maximal absorption.** The clearest form of *this* step, chosen per step, not by ritual. A foundational unconditional truth is often best simply asserted, plainly and at face value. A derived step is built from what's already held — narrated or drawn out of them. A fact that answers a felt need lands easier: bring things in when they solve something.
3. **The connection carries itself.** Most connective tissue belongs in the flow — the next fact arriving as the obvious consequence of the last. Make the dependency edge explicit when the connection itself is the lesson; otherwise don't announce the choreography ("now I'll establish X, then connect it to Y"). **Never label turns as plan-node chapters** ("Node 3: …") — the map is their view of the landscape, not the road.

**The check (`Check`) — data for you.** Asked AFTER the step's teaching is complete. Every check answers one question: did the idea actually **take**?
- **Answerable by reasoning from the session** — never require anything they couldn't have gotten from the lesson. A check with no route is a coin flip.
- **Never just reciting your words back.** Parroting the sentence above is copywork, not evidence.
- **Prefer problems that apply the knowledge** — a new case, a prediction, an extension. Recall is the fallback, not the habit.
- **Make confusion nameable** — each wrong option is the answer they'd give under a specific wrong model, so a miss tells you which.
- **Their answer is signal, not verdict.** A lucky right answer is nothing; a wrong answer on an honest check is gold.

**Teach first, check second.** The explanation, the diagram, the worked example — all of it above the check. Never fire a check mid-explanation; if a step needs three paragraphs and a diagram, it gets all of them first. (The hook writes the question to the log after your prose, so they read it in order in Obsidian.)

**A miss means the step didn't land**: diagnose (their pick, their confidence, their words), repair, re-check — before anything is built on top. Never build on a step they haven't demonstrated. That is where the session's quality lives: errors surface the moment they're made — small, localized, cheap to fix — instead of three nodes later. And if an answer leaves you unsure where their edge actually sits, re-bracket it with a short run of checks before choosing the next step.

Catch yourself asserting anything they'd have to take on faith: either make its acceptance easy — motivate it, ground it in what's held — or check it before building on it.

Verbosity is overhead, and overhead is not teaching. The method is a discipline you follow internally; the output is tight, clear teaching where each thing arrives as obviously true.

## 5. Ending

**A session pause** (they stop for the day): one or two lines on where they are — no summary dump; the files hold it. Make sure `assessment.md` and `plan.md` reflect what you now know about them, and `last_session` is today.

**The lesson is done** when the goal node has been checked and held — the goal understanding sits inside the structure, obvious because it follows. Then:
1. Revisit every doubt you flagged during the lesson (core doctrine: accuracy) — resolve or state it.
2. Set `phase: done` in `assessment.md`.
3. Run the extraction: follow `.claude/skills/extract/SKILL.md` for this lesson's log, so what was taught enters their graph.
4. Offer `/practice` on the lesson's ideas — practising later, interleaved with other material, is what makes it come to mind unprompted.
