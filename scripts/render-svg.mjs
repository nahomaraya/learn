#!/usr/bin/env node
/**
 * render-svg — SVG source -> PNG, for the `svg-maker` subagent.
 *
 * Replaces the pi `visual-tools` render_svg tool. That one shelled out to
 * rsvg-convert (MacPorts) with an ImageMagick fallback; neither has a usable
 * Windows build, so this uses @resvg/resvg-js — the same librsvg-lineage
 * renderer, shipped as a prebuilt native binary, called in-process.
 *
 *   node render-svg.mjs --in figure.svg                    # preview to temp
 *   node render-svg.mjs --in figure.svg --save-as triangle # publish to viz/
 *
 * Without --save-as the PNG stays in the OS temp dir, so only deliberately
 * published images ever land inside the Obsidian vault.
 */

import {
  SCRIPTS_DIR,
  existsSync,
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
  process.stderr.write("usage: render-svg.mjs --in <file.svg> [--save-as <slug>] [--width N]\n")
  process.exit(2)
}
if (!existsSync(inPath)) {
  process.stderr.write(`render-svg: no such file: ${inPath}\n`)
  process.exit(2)
}

let Resvg
try {
  ;({ Resvg } = await import("@resvg/resvg-js"))
} catch {
  process.stderr.write(
    `render-svg: @resvg/resvg-js not installed.\nRun:  npm install --prefix "${SCRIPTS_DIR}"\n`,
  )
  process.exit(3)
}

const svg = readFileSync(inPath, "utf8")

let png
try {
  const resvg = new Resvg(svg, {
    // 2x the author's declared width keeps type crisp at the |500 embed size.
    fitTo: { mode: "width", value: Number(args.width ?? 1600) },
    background: "white", // transparent would vanish against Obsidian's dark theme
    font: { loadSystemFonts: true }, // labels are the whole point; they must resolve
  })
  png = resvg.render().asPng()
} catch (err) {
  process.stderr.write(`render-svg: render failed.\n${err?.message ?? err}\n`)
  process.stderr.write(`\nsource:\n${svg}\n`)
  process.exit(1)
}

const outPath = join(staging("svg"), `preview-${Date.now()}.png`)
writeFileSync(outPath, png)

if (args["save-as"] && typeof args["save-as"] === "string") {
  printResult(publish(outPath, args["save-as"]))
} else {
  process.stdout.write(`preview: ${outPath}\n(Read this path to look at it, then re-run with --save-as <slug> to publish)\n`)
}
