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

## Install

This repo **is** a `.claude` directory. From your learning project's root (which should be inside your Obsidian vault):

```bash
git clone -b claude-code-port https://github.com/<you>/learn .claude
npm install --prefix .claude/scripts
```

Then open Claude Code in that directory. (Or copy the pieces you want into your existing project config.)

## Requirements

- [Claude Code](https://claude.com/claude-code)
- **Node.js** — for the hook and render scripts
- **Google Chrome** — `mermaid-cli` drives it through puppeteer. Auto-detected in the usual Windows and macOS locations; set `PUPPETEER_EXECUTABLE_PATH` if yours lives somewhere else. The bundled Chromium download is skipped deliberately, so Chrome must be present.
- **Obsidian** — to read the lesson log with LaTeX, mermaid and images rendered

## Usage

```
/md-log lessons/2026-10-04-tcp.md
```

Links a markdown file to the session and backfills it. Open that file in Obsidian and read the lesson there as it happens. `/md-unlog` stops.

Then just ask to be taught something. The `teach` skill fires on any explanation.

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
