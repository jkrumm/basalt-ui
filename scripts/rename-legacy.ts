#!/usr/bin/env bun
/**
 * The v3 name codemod (Issue 1703): every `vx` spelling becomes the basalt one, then every generated file is
 * regenerated through its own generator.
 *
 *   `--vx-ink` -> `--basalt-ink`        `.vx-prose` -> `.basalt-prose`     `unknown-vx-token` -> `unknown-basalt-token`
 *   `VX.ink` -> `BASALT.ink`            `VxVar` -> `BasaltVar`             `collectVxNames` -> `collectBasaltNames`
 *   `BASALT_VX_NAMES` -> `BASALT_NAMES` `vx-names.ts` -> `basalt-names.ts` (files are moved with `git mv`)
 *
 * Re-runnable and idempotent: a branch that was in flight when the rename landed rebases, runs it again, and
 * gets its own new lines renamed. Paths and lines `scripts/legacy-names.ts` allows are never touched; that
 * module is also the gate (`scripts/check-legacy-names.ts`) that proves nothing was left behind.
 *
 * Usage: bun scripts/rename-legacy.ts [--prefix basalt] [--no-generate] [--dry]
 *   --prefix       the one parameter: the new name (`basalt` gives `--basalt-*`, `BASALT`, `BasaltVar`)
 *   --no-generate  rewrite and move only, skip the generators
 *   --dry          print what would change, write nothing
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileAllows, lineAllows } from './legacy-names.ts'

const ROOT = resolve(import.meta.dirname, '..')

const TEXT =
  /\.(ts|tsx|mts|cts|js|mjs|cjs|json|css|md|mdx|yml|yaml|html|sh|txt|snap|astro|tpl)$|(^|\/)Makefile$/

/** Names of removed 2.x APIs that a denylist must keep spelling as they were. */
const PROTECTED = ['VxThemeProvider', 'useVxTheme']

export type Rule = { from: RegExp; to: string }

/** The rewrite, in order: the specific shapes before the general ones. */
export function rules(prefix: string): Rule[] {
  const upper = prefix.toUpperCase()
  const title = prefix.charAt(0).toUpperCase() + prefix.slice(1)
  return [
    // CSS custom properties, including a template head `--vx-${name}`.
    { from: /--vx-/g, to: `--${prefix}-` },
    // The bare prefix in prose and patterns: "--vx tokens", `--(vx-)?radius`, `--(?!vx-)`.
    { from: /--vx(?![A-Za-z0-9])/g, to: `--${prefix}` },
    { from: /(?<=--\((?:\?!)?)vx-/g, to: `${prefix}-` },
    // A doubled name collapses: `BASALT_VX_NAMES`, `basaltVxFamilies`.
    { from: new RegExp(`${upper}_VX_`, 'g'), to: `${upper}_` },
    { from: new RegExp(`${prefix}Vx(?=[A-Z])`, 'g'), to: prefix },
    { from: new RegExp(`${title}Vx(?=[A-Z])`, 'g'), to: title },
    // Kebab names: classes, files, lint ids (`.vx-prose`, `gen-vx-names`, `unknown-vx-token`).
    { from: /(?<![A-Za-z0-9])vx-(?=[A-Za-z$])/g, to: `${prefix}-` },
    // The accessor and its constants: `VX`, `VX.ink`, `VX_PATH`, `REMOVED_VX_NAMES`.
    { from: /(?<![A-Za-z0-9])VXI(?![A-Za-z0-9])/g, to: `${upper}_IMPORT` },
    { from: /(?<![A-Za-z0-9])VX(?![A-Za-z0-9])/g, to: upper },
    // Types and camel case: `VxVar`, `collectVxNames`, `uncoveredVx`, `vxFamilyOf`.
    { from: /(?<![A-Za-z0-9])Vx(?=[A-Z0-9_]|(?![A-Za-z0-9]))/g, to: title },
    { from: /(?<=[a-z0-9])Vx(?![a-z])/g, to: title },
    { from: /(?<![A-Za-z0-9])vx(?=[A-Z])/g, to: prefix },
    // The bare word in prose: "the vx names".
    { from: /(?<![A-Za-z0-9-])vx(?![A-Za-z0-9-])/g, to: prefix },
  ]
}

/**
 * Migration rows keep the 2.x name they map `from`; the v3 name they map `to` (and a value shift's `token`)
 * follows the rename, so a row never points at a name v3 does not emit.
 */
const ROW_FILES = /^packages\/basalt-ui\/migrations\/areas\/[^/]+\.json$/
const ROW_TARGET = /^\s*"(to|token)": /

/** Rewrite one file's text; lines `lineAllows` keeps (and the protected names) pass through. */
export function rewrite(text: string, path: string, prefix: string): string {
  const all = rules(prefix)
  const rows = ROW_FILES.test(path)
  return text
    .split('\n')
    .map((line) => {
      if (rows ? !ROW_TARGET.test(line) : lineAllows(path, 'vx', line)) return line
      const held: string[] = []
      let out = line
      for (const name of PROTECTED) {
        out = out.replaceAll(name, () => {
          held.push(name)
          return `\uE000${held.length - 1}\uE000`
        })
      }
      for (const { from, to } of all) out = out.replace(from, to)
      return out.replace(/\uE000(\d+)\uE000/g, (_, i: string) => held[Number(i)] as string)
    })
    .join('\n')
}

/** The new basename of a path that spells `vx`, or `null` when it keeps its name. */
export function renamedBase(path: string, prefix: string): string | null {
  const base = basename(path)
  const next = base.replace(/(?<![A-Za-z0-9])vx-/g, `${prefix}-`)
  return next === base ? null : next
}

function git(args: string[]): string {
  const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout
}

function run(cmd: string[], env: Record<string, string> = {}): void {
  console.log(`$ ${cmd.join(' ')}`)
  const r = spawnSync(cmd[0] as string, cmd.slice(1), {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  })
  if (r.status !== 0) throw new Error(`${cmd.join(' ')} exited ${r.status}`)
}

const PKG = 'packages/basalt-ui'

/** Every generator whose output carries a token name, in dependency order (names, css, docs, build, copies). */
function generate(): void {
  const names = existsSync(join(ROOT, PKG, 'scripts/gen-basalt-names.ts'))
    ? 'gen-basalt-names.ts'
    : 'gen-vx-names.ts'
  run(['bun', `${PKG}/scripts/${names}`])
  run(['bun', `${PKG}/src/css/generate.ts`])
  run(['bun', 'test', `${PKG}/src/tokens/emit-fallback.test.ts`], { UPDATE_GOLDEN: '1' })
  run(['bun', 'test', '--update-snapshots', `${PKG}/src/tokens/emit.test.ts`])
  run(['bun', `${PKG}/src/lint/generated/gen-zone-a.ts`, '--write'])
  run(['bun', `${PKG}/src/core/cn-theme.gen.ts`])
  run(['bun', `${PKG}/scripts/gen-oxlint.ts`])
  run(['bun', `${PKG}/scripts/gen-ui.ts`])
  run(['bun', `${PKG}/scripts/gen-docs.ts`])
  run(['bun', `${PKG}/scripts/gen-recipes.ts`])
  // The build ends in gen-llms (llms.txt); export-surface reads the build.
  run(['sh', '-c', `cd ${PKG} && bun run build`])
  run([
    'sh',
    '-c',
    `cd ${PKG} && node --import ./scripts/css-noop-register.mjs scripts/export-surface.mjs --update`,
  ])
  run(['bun', `${PKG}/scripts/sync-self.ts`])
  run(['bun', 'run', 'fmt'])
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const at = args.indexOf('--prefix')
  const prefix = at === -1 ? 'basalt' : (args[at + 1] ?? '')
  if (!/^[a-z][a-z0-9]*$/.test(prefix)) {
    console.error(`rename-legacy: --prefix takes a lowercase word, got '${prefix}'`)
    process.exit(2)
  }
  const dry = args.includes('--dry')

  const files = git(['ls-files', '-z']).split('\0').filter(Boolean)
  let changed = 0
  for (const path of files) {
    const kept = fileAllows(path, 'vx') && !ROW_FILES.test(path)
    if (!TEXT.test(path) || kept || !existsSync(join(ROOT, path))) continue
    const text = readFileSync(join(ROOT, path), 'utf8')
    const next = rewrite(text, path, prefix)
    if (next === text) continue
    changed++
    if (dry) console.log(`rewrite ${path}`)
    else writeFileSync(join(ROOT, path), next)
  }
  let moved = 0
  for (const path of files) {
    if (fileAllows(path, 'vx') || !existsSync(join(ROOT, path))) continue
    const base = renamedBase(path, prefix)
    if (base === null) continue
    const to = join(dirname(path), base)
    moved++
    if (dry) console.log(`move ${path} -> ${to}`)
    else git(['mv', path, to])
  }
  console.log(`rename-legacy: ${changed} files rewritten, ${moved} moved${dry ? ' (dry run)' : ''}`)
  if (!dry && !args.includes('--no-generate')) generate()
}
