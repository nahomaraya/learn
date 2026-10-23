# learn

[![video](assets/thumbnail.png)](https://www.youtube.com/watch?v=kzcI5F4tGiU)

My AI learning system from this video: [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU).

This is a personal system I built for myself, shared as-is. This branch is the **Claude Code** port: the teaching philosophy encoded in skills, a few hooks and scripts, and agent definitions. (The original [pi](https://github.com/earendil-works/pi) version lives on `main`.)

The skills fold in the doctrine and workflows of [learnharness](https://github.com/amosblomqvist/learnharness) (ported once from v0.3.4, commit `6cba9c8`), a full desktop harness built on the same skeleton. From it come the separate probe and teach phases, the live plan map, predict → teach → check with confidence ratings, practice sessions, and the knowledge graph. Everything learnharness stores inside its own app is kept here as markdown in your Obsidian vault.

## What's in it

- `skills/teach/` — runs a lesson (probe → plan → teach) and resumes one from its files
- `skills/probe/` — measures what you know and what you want, and writes the assessment
- `skills/practice/` — interleaved retrieval practice with a hint ladder and a retest queue
- `skills/extract/`, `skills/import-notes/` — build your knowledge graph from lessons and from your own notes
- `skills/visualize/` — adds a correct, minimal diagram to a lesson when an idea is clearer as a picture
- `doctrine/` — what the skills share: core rules (voice, accuracy, formatting), the two teaching principles, the question craft, the vault layout
- `agents/` — `researcher`, `pdf-reader`, `extractor`, `auditor`, `svg-maker`, `mermaid-maker`: the subagents the system delegates to
- `commands/` — `/md-log`, `/md-unlog`
- `scripts/md-log.mjs` — mirrors the session into a markdown file for reading in Obsidian, and moves the plan map
- `scripts/graph.mjs` — the knowledge graph's store: coverage, merge, Obsidian notes
- `scripts/lesson-context.mjs` — re-injects the active lesson's assessment and plan after compaction or resume
- `scripts/render-mermaid.mjs`, `scripts/render-svg.mjs` — render backends for the visual makers
- `settings.json` — wires the hooks

## What ends up in your vault

```
lessons/<topic>/log.md          the lesson transcript, as you read it
lessons/<topic>/assessment.md   what the probe measured; `phase:` is the lesson's state
lessons/<topic>/plan.md         the plan map, with current and visited nodes highlighted
practice/<date>-<topic>.md      practice transcripts
practice/retest.md              misses waiting for a retest
graph/<idea>.md                 one note per idea you were taught, linked by how they derive
viz/                            verified diagrams
```

A lesson can span any number of sessions, because everything it needs to resume is in those files. Open **Graph view** in Obsidian to see the knowledge graph: each note links the ideas it follows from and the ideas it leads to.

## Requirements

- **[Claude Code](https://claude.com/claude-code)**
- **Git**
- **Node.js 18+** — runs the md-log hook and the render scripts (developed on Node 24)
- **Google Chrome** — `mermaid-cli` drives it through puppeteer. Auto-detected in the usual Windows and macOS locations; set `PUPPETEER_EXECUTABLE_PATH` if yours lives elsewhere. The bundled Chromium download is skipped deliberately, so a real Chrome install must be present.
- **[Obsidian](https://obsidian.md)** — the reading surface. LaTeX, mermaid and images render there; they don't in a terminal.

Only Claude Code and Git are strictly required — see [Taking just the parts you want](#taking-just-the-parts-you-want) if you'd rather skip the rest.

## Install

This repo **is** a `.claude` directory. You clone it *as* the config folder of a project that doubles as your Obsidian vault.

```bash
# 1. a folder for your learning project — this becomes the Obsidian vault
mkdir my-learning && cd my-learning

# 2. the repo IS .claude
git clone -b claude-code-port https://github.com/nahomaraya/learn.git .claude

# 3. install the render backends (~200 MB)
npm install --prefix .claude/scripts
```

The skills create `lessons/`, `practice/` and `graph/` themselves.

**Pick a path without spaces or apostrophes.** Every script resolves paths from its own location rather than the working directory, so odd paths do work — but you'll be typing this path into shell commands, and `Nahom's personal Vault` is a quoting minefield you don't need.

### Point Obsidian at it

Obsidian → **Open folder as vault** → your project folder. Two settings make the difference between readable and cramped:

- **Settings → Editor → Readable line length: off** — otherwise diagrams get squeezed
- Work in **Reading view** (`Ctrl+E` / `Cmd+E`) so LaTeX, mermaid and images render instead of showing source

Keep Obsidian open beside your terminal. You **read** in Obsidian; you **answer** in the terminal.

## First session

```bash
cd my-learning
claude
```

Then:

```
/teach how DNS works
```

That creates `lessons/how-dns-works/`, links its `log.md` (no `/md-log` needed) and starts the probe. Open the log in Obsidian beside the terminal.

| You want to | Run |
|---|---|
| start a lesson | `/teach <topic>` |
| continue one | `/teach <lesson>`, or plain `/teach` to pick from the unfinished ones |
| only find out where you stand | `/probe <topic>` |
| practise what you learned | `/practice [topic]` (plain `/practice` starts from the retest queue) |
| update the knowledge graph | `/extract` (`/teach` runs it when a lesson finishes) |
| add your own notes to the graph | `/import-notes <file or folder>` |
| log to a file of your choosing | `/md-log <path>`, and `/md-unlog` to stop |

### Verify the install

Two checks you can run without starting a session:

```bash
# paths resolve and Chrome is found
node -e "import('./.claude/scripts/_common.mjs').then(m=>console.log('root:',m.PROJECT_ROOT,'\nchrome:',m.findChrome()))"

# the renderer actually renders
mkdir -p .claude/.scratch
printf 'graph TD\n  A[it] --> B[works]\n' > .claude/.scratch/t.mmd
node .claude/scripts/render-mermaid.mjs --in .claude/.scratch/t.mmd
```

`root:` must be your project folder (not `.claude`), and `chrome:` must be a real path. The render prints a `preview:` path you can open.

And the script tests (no dependencies beyond Node):

```bash
npm test --prefix .claude/scripts
```

Then the one check that needs a live session: after `/teach` and one exchange, `lessons/<topic>/log.md` should contain `> [!quote] YOU` and `> [!abstract] CLAUDE` callouts. If it's empty, see below.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Log file stays empty | The hooks aren't firing. `settings.json` uses relative commands (`node .claude/scripts/md-log.mjs`), which assume hooks run from the project root. Replace them with absolute paths, or `node "$CLAUDE_PROJECT_DIR/.claude/scripts/md-log.mjs"`. Run `claude --debug` to see hook execution. |
| Plan map doesn't highlight | The hook only moves it for `Predict`/`Check` questions tagged `[node: <slug>]` whose slug is declared in `plan.md`, one node per line. The agent is told when a slug is unknown. |
| `Chrome not found` | Install Chrome, or `export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome`. |
| `Cannot find package 'puppeteer'` | `npm install` didn't finish. puppeteer is a *peer* dependency of mermaid-cli and isn't auto-installed, which is why it's declared directly in `scripts/package.json` — so this means the install itself failed. Re-run it. |
| npm fails with `ECONNRESET` | Flaky network, and npm **rolls back silently while still reporting success**. Re-run until `ls .claude/scripts/node_modules/puppeteer` exists. It took three attempts on the machine this was built on. |
| Images don't render in Obsidian | `viz/` has to sit inside the vault. Check that `PROJECT_ROOT` above points at your vault folder. Embeds resolve by filename, so the `viz/` folder can be anywhere *within* it. |
| Quizzes show 5+ options | They can't — `AskUserQuestion` caps at four, which is why the skill budgets three distractors plus "I don't know". |

## What to expect

Worth knowing before your first lesson, because it feels wrong otherwise:

1. **It quizzes you hard before teaching anything.** The probe binary-searches for the edge of what you already know. It opens each strand near the hardest thing your goal needs and works down when you miss. A run of correct answers means the questions were too easy, so it goes higher. This is the design working, not stalling.
2. **Every graded question also asks how sure you are.** Answer honestly: a wrong answer at 95% is the most useful thing it can find. **"I don't know"** is treated as a genuine gap to teach into, never as a wrong answer. Pick **Other** to type your reasoning; it's read in full and steers what comes next.
3. **It stops and shows you a plan**: prose plus the live map (`plan.md`, embedded in the log), with foundations at the roots, your goal at the sink, and only what you're missing in between. It waits for your go-ahead. Read the roots carefully; this is the cheap moment to catch a wrong foundation. The map gets redrawn mid-lesson when your answers show the plan was wrong about you.
4. **Then it teaches one step at a time**: a prediction before the step (a nudge, where guessing is the point), the teaching, then a check after. It won't build on a step you missed.
5. **No praise.** The dry voice is deliberate; moving on to the next step is the acknowledgement.

## Taking just the parts you want

The teaching philosophy is the valuable part and it has **zero dependencies**:

```bash
mkdir -p .claude/skills
cp -r path/to/this/repo/skills/teach .claude/skills/
```

Copy `doctrine/` and `skills/probe/` alongside it (and `skills/practice/` if you want practice), because the skills read `.claude/doctrine/`. That alone works in any Claude Code project, with no Node, no Chrome and no Obsidian. You lose the Obsidian log, the plan-map highlighting, the knowledge graph and the verified diagrams. You keep the whole probe → plan → teach process, since it's all prose.

To make it available in every project instead of one, put the pieces in `~/.claude/` rather than `./.claude/`. Be aware the `Stop` hook then runs in *all* your sessions — harmless (it exits immediately when no file is linked), but it is running.

## How this differs from the pi version

Claude Code has no extension API, so the three pi extensions were rebuilt on the primitives it does have:

| pi | here |
|---|---|
| `ask-user-question` extension | built-in `AskUserQuestion` tool |
| `quiz` extension | `AskUserQuestion` + the agent grading in its next message |
| `md-log` extension | three hooks (`PreToolUse`, `PostToolUse`, `Stop`) running `scripts/md-log.mjs` |
| `visual-tools` extension | `scripts/render-*.mjs`, called from the makers' `Bash` |
| `subagent` tool | built-in `Agent` tool |

Four consequences worth knowing:

- **Quizzes get three options plus "I don't know."** `AskUserQuestion` caps at four. The correct answer is never a tool parameter — the agent holds it and opens its next message with the verdict — so it still cannot leak, but the ✓/✗ arrives as prose rather than inside the popup.
- **The question still reaches Obsidian before you answer.** The `PreToolUse` hook writes it, and flushes any prose ahead of it first, so the log stays in true order. That's what lets you read a LaTeX-heavy question rendered while the terminal waits.
- **The makers are no longer sandboxed.** In pi they had purpose-built `write_*`/`render_*` tools and could not touch anything else; here they get `Write`/`Edit`/`Bash`/`Read`. The render-and-inspect loop is intact — Claude Code's `Read` displays PNGs, so they still look at the image before publishing — but the isolation guarantee is gone.
- **`researcher` runs on Opus**, since no equivalent of the original's model is reachable from Claude Code. It is the accuracy backstop for everything taught, and `teach` calls it liberally, so lessons cost more than they would on Sonnet. Change `model:` in `agents/researcher.md` if you'd rather trade accuracy for cost.

## How this differs from learnharness

learnharness is an Electron app with its own UI and JSON store. Here the same doctrine runs on Claude Code's primitives, with markdown as the store:

| learnharness | here |
|---|---|
| prober and teacher as two agents with a `probe_done` handoff | `/probe` writes `assessment.md`; `/teach` reads it |
| quiz card with a confidence slider and a thinking field | `AskUserQuestion` with a `Confidence` companion question; "Other" carries your reasoning |
| live plan window, `plan_init`, `nodeId` tags | `plan.md` + `[node: slug]` tags; the md-log hook highlights the current and visited nodes |
| background research and PDF jobs that report back as messages | background `researcher` and `pdf-reader` subagents |
| practice `problem` / `conclude` tools with a hidden solution | the solution is written to `.claude/.scratch/` before the problem is posed, then revealed as a folded callout |
| extraction → audit → merge into `graph/*.jsonl` | the same three stages: `extractor` + `auditor` subagents, then `graph.mjs` merges and renders `graph/*.md` |
| context compaction that preserves the learner model | built-in compaction + a `SessionStart` hook that re-injects the assessment and plan |

**Not ported:**
- interactive HTML demos, and their headless test runner
- dictation
- the cost meter
- the provider picker
- in-app prompt overrides
- auto-update
- the tool-argument repair layers (Claude Code's tool calls don't need them)

Two smaller differences: checks don't hide behind a "Check your understanding" button (the popup simply follows the prose), and the graph notes are generated, so edit the lessons rather than `graph/*.md`.

## Notes

You can run the system without subagents. The main session does the teaching. You just lose the researcher (truth verification) and the generated visuals.

The teaching skills are written for one learner (me). Edit `doctrine/` and the skills to fit how you learn best.
