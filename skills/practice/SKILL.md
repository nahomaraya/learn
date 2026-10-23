---
name: practice
description: Run a practice session — interleaved retrieval problems on ideas the learner has already been taught, with a committed hidden solution, a one-rung-per-request hint ladder, honest verdicts, and fresh-surface retests of every miss. Starts from the retest queue, picked graph ideas, a topic, or a file. Use when they want to practise, drill, review, or make something they learned come to mind unprompted.
argument-hint: "[topic | graph idea ids | file]"
---

# Practice

**First, read** `.claude/doctrine/core.md`, `.claude/doctrine/vault.md` and `.claude/skills/practice/doctrine.md`. They are part of these instructions. (Practice asks no multiple-choice questions, so the questions doctrine doesn't apply — every problem is free production.)

## The opening — straight to problems

1. **Create and link the log**: `practice/<YYYY-MM-DD>-<slug>.md`, then `node .claude/scripts/md-log.mjs --link practice/<file>.md`.
2. **Gather the material.** In order of precedence:
   - **Retest queue** — read `practice/retest.md`. Unchecked items whose ideas touch today's material (or all of them, with no argument) open the session's main body after the warm-up.
   - **Graph ideas** — ids given, or a topic: `node .claude/scripts/graph.mjs list` / `Grep` `graph/` for the cluster; read the notes for their statements and chains (`Follows from` / `Leads to` are what composition and discrimination demands are built from).
   - **Free-form** — a topic in their words, course material, a file, a PDF (`pdf-reader`). A topic description is already material enough. Never balk at a free-form start, never ask them to restate it, never treat graph ideas as the only legitimate entry.
   - **No argument and an empty queue** → one non-graded `AskUserQuestion` offering the lessons in `lessons/` (and "something else").
3. **As soon as the material for a problem exists, pose.** At most one short line of orientation — never a warm-up exchange, never clarifying questions when the material already bounds the demand. Calibration comes from the opening demands themselves (open warm).

## Posing a problem

**Every problem is posed in this exact form — never as loose chat prose.**

1. **Commit first.** Before they see anything, `Write` `.claude/.scratch/practice/<log-name>-p<N>.md` containing: target idea(s) (graph ids when there are any), mode, the model solution with its moves in order, and the shortcuts you tried and ruled out. Solve and shortcut-hunt the problem yourself before writing it; the committed solution is your own worked solution, never a hope. If a fact in it feels even slightly unsure, verify it with a background `researcher` and pose once the brief lands — a wrong model solution grades them against a lie.
2. **Pose** in one message, then end your turn:

   ```markdown
   > [!todo] Problem <N>
   > <the statement — LaTeX for all math; never names its target>
   ```

Only one problem is active at a time. They work in chat — every reply is their thinking. Whether a reply claims an answer is in the text; read it. Working traces, "I'm stuck", questions → the hint ladder, one rung per request. A claimed answer → extract the moves, deliver the verdict (doctrine §VII).

## Concluding a problem

When they've solved it, or explicitly ask to end it (or to skip it — treat that as surrender: mark it for retest):

1. **Reveal** — `Read` the committed file and give them its model solution verbatim, folded:

   ```markdown
   > [!success]- Model solution — Problem <N>
   > <the committed solution>
   ```

2. **Record** — one line:

   ```markdown
   > [!info] Problem <N> — <solved | surrendered> · rung <R0–R5, the highest given> · miss <cue | discrimination | execution | careless | structural | none> · retest <yes | no>
   ```

3. Your closing words about their work — the read of their thinking, what the verdict means, one earned credit — then **end your turn**. No new problem in the same reply.

**The pause.** Every concluded problem opens a pause that belongs to them: questions about the problem just finished — what went wrong, why a move was right, what a hint meant. Answer fully but surgically — repairs and clarifications at practice scale, never re-teaching — and end each answer's turn. The next problem is posed **only** when they explicitly move on ("next", or their own words asking for one). A clarification question is never the go-ahead; when in doubt, answer and wait.

## The retest queue

- A problem concluded with `retest yes` gets a fresh-surface retest later in this session (the arc's close). If the session ends before it, append it to `practice/retest.md` in the `vault.md` format.
- A queue item retested in a fresh surface and solved at R0–R1 is checked off (`- [x] … — retested <date>, solved at R<n>`). Solved only with heavier hints → leave it unchecked and note the date.

## Ending

When the arc is complete (warm open, interleaved body, every miss retested or queued), wrap up in text: what came to mind unaided, what needed help, what's queued. Practice writes nothing to the graph. Then run any pending lesson extraction (`node .claude/scripts/graph.mjs pending`; if lesson logs are pending, follow `.claude/skills/extract/SKILL.md`) so the graph is current for next time.
