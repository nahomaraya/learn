# learn

[![video](assets/thumbnail.png)](https://www.youtube.com/watch?v=kzcI5F4tGiU)

My AI learning system from this video: [How I Use AI to Learn Things](https://www.youtube.com/watch?v=kzcI5F4tGiU).

This is a personal system I built for myself, shared as-is. This branch is the **Claude Code** port: the teaching philosophy encoded in a skill, a few hooks and scripts, and agent definitions. (The original [pi](https://github.com/earendil-works/pi) version lives on `main`.)

## What's in it

- `skills/teach/` — the philosophy and the process
- `skills/visualize/` — adds a correct, minimal diagram to a lesson when an idea is clearer as a picture
- `agents/` — `researcher`, `svg-maker`, `mermaid-maker`: the subagents the system delegates to
- `commands/` — `/md-log`, `/md-unlog`
- `scripts/md-log.mjs` — mirrors the session into a markdown file for reading in Obsidian
- `scripts/render-mermaid.mjs`, `scripts/render-svg.mjs` — render backends for the visual makers
- `settings.json` — wires the md-log hooks

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

# 4. somewhere for lesson logs to live
mkdir lessons
```

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
/md-log lessons/first-lesson.md
```

That links the markdown file and backfills the session into it. `/md-unlog` stops. Now say what you want to learn — *"teach me how DNS works"*. The `teach` skill fires on any explanation, so you don't invoke anything by hand.

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

Then the one check that needs a live session: after `/md-log` and one exchange, `lessons/first-lesson.md` should contain `> [!quote] YOU` and `> [!abstract] CLAUDE` callouts. If it's empty, see below.

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Log file stays empty | The hooks aren't firing. `settings.json` uses the relative command `node .claude/scripts/md-log.mjs`, which assumes hooks run from the project root. Replace all three with an absolute path, or `node "$CLAUDE_PROJECT_DIR/.claude/scripts/md-log.mjs"`. Run `claude --debug` to see hook execution. |
| `Chrome not found` | Install Chrome, or `export PUPPETEER_EXECUTABLE_PATH=/path/to/chrome`. |
| `Cannot find package 'puppeteer'` | `npm install` didn't finish. puppeteer is a *peer* dependency of mermaid-cli and isn't auto-installed, which is why it's declared directly in `scripts/package.json` — so this means the install itself failed. Re-run it. |
| npm fails with `ECONNRESET` | Flaky network, and npm **rolls back silently while still reporting success**. Re-run until `ls .claude/scripts/node_modules/puppeteer` exists. It took three attempts on the machine this was built on. |
| Images don't render in Obsidian | `viz/` has to sit inside the vault. Check that `PROJECT_ROOT` above points at your vault folder. Embeds resolve by filename, so the `viz/` folder can be anywhere *within* it. |
| Quizzes show 5+ options | They can't — `AskUserQuestion` caps at four, which is why the skill budgets three distractors plus "I don't know". |

## What to expect

Worth knowing before your first lesson, because it feels wrong otherwise:

1. **It quizzes you hard before teaching anything.** Phase 1 binary-searches for the edge of what you already know. The skill explicitly says a run of correct answers means the questions were too easy — so it escalates until you miss something. This is the design working, not stalling.
2. **Use "I don't know" honestly.** It's treated as a genuine gap to teach into, never as a wrong answer, and it's far better signal than a guess.
3. **It stops and shows you a plan** — prose plus a mermaid dependency graph, foundations at the roots, your goal at the sink. It waits for your go-ahead. Read the roots carefully; this is the cheap moment to catch a wrong foundation.
4. **Then it teaches one node at a time**, quizzing after each, and won't build on a node you missed.

## Taking just the parts you want

The teaching philosophy is the valuable part and it has **zero dependencies**:

```bash
mkdir -p .claude/skills
cp -r path/to/this/repo/skills/teach .claude/skills/
```

That alone works in any Claude Code project — no Node, no Chrome, no Obsidian. You lose the Obsidian log and the verified diagrams; you keep the whole probe → plan → teach process, since it's all prose.

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

## Notes

You can run the system without subagents. The main session does the teaching. You just lose the researcher (truth verification) and the generated visuals.

The teaching skill is written for one learner (me). Edit the skill to fit how you learn best.
