#!/usr/bin/env node
/**
 * render-mermaid — Mermaid source -> PNG, for the `mermaid-maker` subagent.
 *
 * Replaces the pi `visual-tools` render_mermaid tool. The maker no longer gets a
 * sandboxed tool; it writes a .mmd with Write/Edit, runs this, and Reads the
 * returned PNG (Claude Code's Read displays images, so the render-and-inspect
 * loop survives intact).
 *
 * Renders via @mermaid-js/mermaid-cli, which drives Chrome through puppeteer.
 * The pi original hardcoded macOS Chrome paths; findChrome() in _common.mjs
 * looks in the Windows locations first and falls back to the macOS ones.
 *
 *   node render-mermaid.mjs --in diagram.mmd                 # preview to temp
 *   node render-mermaid.mjs --in diagram.mmd --save-as flow  # publish to viz/
 *
 * Without --save-as the PNG stays in the OS temp dir, so only deliberately
 * published images ever land inside the Obsidian vault.
 */

import { spawnSync } from "node:child_process"
import {
  SCRIPTS_DIR,
  existsSync,
  findChrome,
  join,
  parseArgs,
  printResult,
  publish,
  readFileSync,
  staging,
  writeFileSync,
} from "./_common.mjs"

const args = parseArgs(process.argv.slice(2))
const inPath = args.in
if (!inPath || typeof inPath !== "string") {
  process.stderr.write("usage: render-mermaid.mjs --in <file.mmd> [--save-as <slug>] [--scale N]\n")
  process.exit(2)
}
if (!existsSync(inPath)) {
  process.stderr.write(`render-mermaid: no such file: ${inPath}\n`)
  process.exit(2)
}

const cliEntry = join(SCRIPTS_DIR, "node_modules", "@mermaid-js", "mermaid-cli", "src", "cli.js")
if (!existsSync(cliEntry)) {
  process.stderr.write(
    `render-mermaid: mermaid-cli not installed.\nRun:  npm install --prefix "${SCRIPTS_DIR}"\n`,
  )
  process.exit(3)
}

const chrome = findChrome()
if (!chrome) {
  process.stderr.write(
    "render-mermaid: Chrome not found. Install Chrome, or set PUPPETEER_EXECUTABLE_PATH.\n",
  )
  process.exit(3)
}

const work = staging("mermaid")
const outPath = join(work, `preview-${Date.now()}.png`)

// --no-sandbox keeps Chrome happy when launched from a hook/subagent context.
const puppeteerConfig = join(work, "puppeteer-config.json")
writeFileSync(puppeteerConfig, JSON.stringify({ args: ["--no-sandbox", "--disable-dev-shm-usage"] }))

const res = spawnSync(
  process.execPath,
  [
    cliEntry,
    "--input", inPath,
    "--output", outPath,
    "--outputFormat", "png",
    "--backgroundColor", "white", // transparent would vanish against Obsidian's dark theme
    "--scale", String(args.scale ?? 2), // crisp when embedded at |500
    "--puppeteerConfigFile", puppeteerConfig,
  ],
  {
    encoding: "utf8",
    timeout: 120000,
    env: { ...process.env, PUPPETEER_EXECUTABLE_PATH: chrome },
  },
)

if (res.status !== 0 || !existsSync(outPath)) {
  process.stderr.write("render-mermaid: render failed.\n")
  process.stderr.write(`source:\n${readFileSync(inPath, "utf8")}\n`)
  if (res.stderr) process.stderr.write(`\n${res.stderr}\n`)
  if (res.stdout) process.stderr.write(`\n${res.stdout}\n`)
  process.exit(1)
}

if (args["save-as"] && typeof args["save-as"] === "string") {
  printResult(publish(outPath, args["save-as"]))
} else {
  process.stdout.write(`preview: ${outPath}\n(Read this path to look at it, then re-run with --save-as <slug> to publish)\n`)
}
