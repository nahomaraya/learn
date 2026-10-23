---
name: extract
description: Extract what lessons taught into the learner's knowledge graph — true ideas and the reasoning chains that derive them — as linked Obsidian notes in graph/. Processes only log text not yet extracted. Use after a lesson (teach runs it when a lesson is done), when they ask to update the graph, or via /import-notes for their own notes.
argument-hint: "[notes files — omit to process lesson logs]"
---

# Extract

The graph is built by a three-stage pipeline — the same one learnharness runs — and you are its orchestrator, not a stage. Two subagents do the judgement; `graph.mjs` does every deterministic part. Never write `graph/` files yourself.

| Stage | Who | Sees | Produces |
|---|---|---|---|
| extract | `extractor` agent | one stretch of the source + THE GRAPH SO FAR for that source | findings: new ideas + chains |
| audit | `auditor` agent | the findings, and the graph through its read tools — never the source | identity links to existing ideas |
| merge | `graph.mjs merge` | both | the graph, simplified; every note re-rendered; coverage advanced |

## Run

1. **What's pending:**

   ```bash
   node .claude/scripts/graph.mjs pending [notes files...]
   ```

   One JSON line per stretch: `{"source", "offset", "limit", "through"}`. With no arguments it covers every `lessons/*/log.md`; notes files given as arguments are added (that's `/import-notes`). `(nothing pending)` → say so and stop.

2. **For each stretch, in order** — stretches of one source run strictly in sequence, because each extraction builds on the previous merge. Use `n` as a running counter for scratch names.

   a. **Digest:** `node .claude/scripts/graph.mjs digest --source <source>` — keep the output verbatim.

   b. **Extract** — dispatch `extractor` and wait for it:

   ```
   Agent(subagent_type: "extractor", prompt: """
   MODE: session            ← or "notes" for an imported notes file
   SOURCE: <source>
   READ: offset <offset>, limit <limit>
   OUTPUT: .claude/.scratch/extract/<n>-findings.json
   THE GRAPH SO FAR:
   <digest output, verbatim>
   """)
   ```

   c. **Audit** — dispatch `auditor` and wait for it:

   ```
   Agent(subagent_type: "auditor", prompt: """
   FINDINGS: .claude/.scratch/extract/<n>-findings.json
   OUTPUT: .claude/.scratch/extract/<n>-verdicts.json
   """)
   ```

   d. **Merge:**

   ```bash
   node .claude/scripts/graph.mjs merge --source <source> --findings .claude/.scratch/extract/<n>-findings.json --verdicts .claude/.scratch/extract/<n>-verdicts.json --through <through>
   ```

   `INVALID: <problem>` means nothing was written. Send the problem back to the extractor (continue the same agent with `SendMessage` if available, otherwise re-dispatch with the problem appended), then audit and merge again. After two failed retries, skip the stretch and report it — it stays pending for next time. Never hand-edit findings to make them pass.

3. **Report** in two or three lines: per source, new ideas, linked ideas, chains; and that the notes are in `graph/` (Obsidian's graph view shows them, linked by `Follows from` / `Leads to`).

## Notes

- Coverage is advanced only by a successful merge, so an interrupted run loses nothing — rerun and it resumes.
- Editing an already-extracted file makes it pending from the top again; that's safe — the auditor links re-found ideas to the nodes they already are.
- Practice logs are never extracted: practice exercises ideas, it doesn't teach new ones.
