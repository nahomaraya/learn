/**
 * Shared helpers for the render scripts and the md-log hook.
 *
 * Path model: this repo is cloned AS the project's `.claude/` directory, so
 * scripts live at `<project>/.claude/scripts/` and the project root (which is
 * inside the Obsidian vault) is two levels up. Everything resolves from the
 * script's own location rather than cwd, so hooks and subagent Bash calls
 * agree no matter where they are invoked from.
 *
 * Windows paths below use forward slashes deliberately — Node accepts them on
 * Windows, and they survive every quoting context without escaping games.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
export const CLAUDE_DIR = resolve(SCRIPTS_DIR, "..")

/**
 * The project root — i.e. the Obsidian vault folder that `viz/` belongs in.
 *
 * Normally this is just the parent of `.claude/`, but that breaks when `.claude`
 * is a symlink or junction (a common dotfiles setup): Node resolves
 * import.meta.url to the link's TARGET, so the parent would be wherever the
 * repo really lives rather than the vault. So prefer signals that describe
 * where Claude Code is actually running, and keep the parent as a fallback.
 */
function findProjectRoot() {
  const env = process.env.CLAUDE_PROJECT_DIR // set by Claude Code for hooks
  if (env && existsSync(env)) return resolve(env)
  const cwd = process.cwd() // subagent Bash calls run from the project root
  if (existsSync(join(cwd, ".claude"))) return cwd
  return resolve(CLAUDE_DIR, "..")
}

export const PROJECT_ROOT = findProjectRoot()

/** Published PNGs land here — inside the vault, so Obsidian resolves `![[name.png]]`. */
export const VIZ_DIR = join(PROJECT_ROOT, "viz")

/** Transient sources and previews stay OUT of the vault. */
export const STAGING_ROOT = join(tmpdir(), "claude-visual-tools")

/**
 * Chrome is needed by mermaid-cli (puppeteer). Windows paths first since that
 * is where this is used; the macOS ones are kept so the repo still works if
 * cloned on a Mac.
 */
function chromeCandidates() {
  const local = (process.env.LOCALAPPDATA ?? "").replace(/\\/g, "/")
  return [
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    local ? `${local}/Google/Chrome/Application/chrome.exe` : "",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean)
}

export function findChrome() {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH
  if (env && existsSync(env)) return env
  for (const c of chromeCandidates()) if (existsSync(c)) return c
  return undefined
}

export function staging(group) {
  const dir = join(STAGING_ROOT, group)
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Copy a rendered PNG into <project>/viz with a unique, slugified name. */
export function publish(pngPath, slug) {
  mkdirSync(VIZ_DIR, { recursive: true })
  const clean =
    String(slug)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "viz"
  const filename = `viz-${clean}-${Date.now()}.png`
  const dest = join(VIZ_DIR, filename)
  copyFileSync(pngPath, dest)
  return { filename, path: dest }
}

/** Minimal flag parser: --key value, plus bare --flag booleans. */
export function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("--")) continue
    const key = a.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith("--")) out[key] = true
    else {
      out[key] = next
      i++
    }
  }
  return out
}

/** Emit the RESULT block the maker subagents are told to echo back verbatim. */
export function printResult({ filename, path }) {
  process.stdout.write(`RESULT:\nfilename: ${filename}\npath: ${path}\n`)
}

export { existsSync, mkdirSync, readFileSync, writeFileSync, join, resolve, dirname }
