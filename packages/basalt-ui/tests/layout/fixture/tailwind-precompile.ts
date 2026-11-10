/**
 * Compiles `tailwind.css` into `tailwind.generated.css` with the Tailwind CLI, before any layout test
 * boots the fixture. Registered as a `preload` in `tests/layout/bunfig.toml`, so every entry point
 * that reaches the suite through that config (`test:layout`, `test:layout:harness`, `make layout`)
 * runs it once per `bun test` process.
 *
 * WHY A PRECOMPILE AND NOT A BUN PLUGIN. The fixture is bundled by `Bun.build` inside
 * `harness/engine.ts`, which passes no `plugins`, and a runtime `Bun.plugin` is not applied to
 * `Bun.build`. The compiled sheet therefore has to exist on disk before the build starts.
 *
 * The local CLI binary is used, never `bunx`.
 */
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixtureDir = fileURLToPath(new URL('.', import.meta.url))
const input = `${fixtureDir}tailwind.css`
const output = `${fixtureDir}tailwind.generated.css`
const repoRoot = fileURLToPath(new URL('../../../../../', import.meta.url))
const cli = `${repoRoot}node_modules/.bin/tailwindcss`

if (!existsSync(cli)) {
  throw new Error(
    `LAYOUT: the Tailwind CLI is missing at ${cli} — run \`bun install\` (devDependency @tailwindcss/cli).`,
  )
}

const result = Bun.spawnSync([cli, '--input', input, '--output', output], {
  cwd: repoRoot,
  stdout: 'pipe',
  stderr: 'pipe',
})
if (result.exitCode !== 0) {
  throw new Error(
    `LAYOUT: compiling the fixture's Tailwind entry failed (exit ${result.exitCode}):\n${result.stderr.toString()}`,
  )
}

// What the compiled sheet must NOT carry, because this fixture renders the 2.x Mantine tree and
// measures it against what that tree looked like before Tailwind joined the page:
//
// - `@font-face`. `fonts.css` is inlined with its relative `url(./files/…)` un-rebased (the bundle
//   cannot resolve them), and its faces (the `wdth` Hubot cut, `Head Digits`) would redefine the
//   families `styles.css` already loads, moving every head-face and digit measurement.
// - Tailwind's preflight, the top-level `@layer base { … }`. A Mantine app brings its own reset, and
//   preflight's element defaults shift form-row geometry (VERIFIED: dropping only this block takes
//   `forms-w46` from 3.6 px off-centre back to green).
//
// The v3 fixture (`fixture/v3`) is where the full sheet, preflight included, belongs.
function dropLayerBlocks(css: string, layer: string): string {
  const open = new RegExp(`^@layer ${layer} \\{`, 'm')
  let out = css
  for (let match = open.exec(out); match !== null; match = open.exec(out)) {
    let depth = 0
    let end = match.index + match[0].length - 1
    for (; end < out.length; end++) {
      if (out[end] === '{') depth++
      else if (out[end] === '}' && --depth === 0) break
    }
    out = out.slice(0, match.index) + out.slice(end + 1)
  }
  return out
}

const compiled = await Bun.file(output).text()
const trimmed = dropLayerBlocks(compiled.replaceAll(/@font-face\s*\{[^}]*\}\s*/g, ''), 'base')
if (trimmed !== compiled) await Bun.write(output, trimmed)
