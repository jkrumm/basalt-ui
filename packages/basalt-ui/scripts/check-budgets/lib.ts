/**
 * The kit every area file shares: the row and raise types, repo paths, file counters, and the typed
 * "could not measure" signal. Runtime imports are `node:*` only, so the runner and the ratchet load
 * without Vite.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import type { Manifest, Surface } from '../surface-gates'

export const PKG_ROOT = join(import.meta.dir, '..', '..')
export const REPO_ROOT = join(PKG_ROOT, '..', '..')

/** A row's measurement: a count, or a count with the violation lines printed under it (gate rows). */
export type Measured = number | { readonly value: number; readonly detail: readonly string[] }

export type Ctx = {
  /** The built root entry the bundle fixtures resolve `basalt-ui` to. */
  readonly providerOnlyDist: string
  /** Run `build` once per key; rows that share one expensive result share its promise (and failure). */
  once<T>(key: string, build: () => Promise<T>): Promise<T>
}

export type RowDef = {
  /** Stable key the ratchet joins on across branches. Never reuse one for a different metric. */
  readonly id: string
  /** Print position, ascending; ties break on `id`. A new lane picks its own range. */
  readonly order: number
  readonly label: string
  readonly ceiling: number
  /** Throws `Unmeasured` when an input is absent; any other throw prints as a `failed` row. */
  readonly measure: (ctx: Ctx) => Measured | Promise<Measured>
}

/**
 * The one way a ceiling goes up: a row in the area file that raised it. `ceiling` is the `id` of the
 * row; `from`/`to` must match the base-branch and current ceilings exactly, so a row cannot cover a
 * later raise. `repo` names a consumer repo other than argo (95 of 124 2.x values named argo).
 */
export type Raise = {
  readonly ceiling: string
  readonly from: number
  readonly to: number
  readonly consumer: string
  readonly repo: string
}

/** What an area file exports. */
export type AreaModule = { readonly rows: readonly RowDef[]; readonly raises?: readonly Raise[] }

/** A printed row. `value: null` is "could not be measured here" and fails the gate. */
export type Budget = {
  readonly label: string
  readonly value: number | null
  readonly ceiling: number
  readonly unmeasured?: { readonly kind: 'skipped' | 'failed'; readonly reason: string }
  readonly detail?: readonly string[]
}

/** `skipped`: an input is absent (no `dist/`). Fails the gate closed, passes `--report`. */
export class Unmeasured extends Error {
  readonly kind = 'skipped'
}

/** A gate-shaped measurement: the value is the violation count, the row's ceiling is zero. */
export function gate(violations: readonly string[]): Measured {
  return { value: violations.length, detail: violations }
}

/** Every regular file under `dir` whose name matches `pattern`, recursing into subdirectories. */
export function walkFiles(dir: string, pattern: RegExp): string[] {
  const glob = new Bun.Glob('**/*')
  const out: string[] = []
  for (const rel of glob.scanSync({ cwd: dir, onlyFiles: true })) {
    if (pattern.test(rel)) out.push(join(dir, rel))
  }
  return out
}

export function totalLines(paths: readonly string[]): number {
  return paths.reduce((sum, path) => {
    const text = readFileSync(path, 'utf8')
    return sum + (text.length === 0 ? 0 : text.split('\n').length)
  }, 0)
}

export function readSurface(): Surface {
  // Required on first read, through a variable so the bundler does not resolve it at load: the
  // area-discovery test runs a copy of this file with no sibling helper, and no area there reads it.
  const helper = '../export-surface-shards.mjs'
  const shards = require(helper) as typeof import('../export-surface-shards.mjs')
  return shards.readShards(join(PKG_ROOT, 'scripts/export-surface'))
}

export function readManifest(): Manifest {
  return JSON.parse(readFileSync(join(PKG_ROOT, 'package.json'), 'utf8')) as Manifest
}

/** An ANSI color sequence. Built from a char code: a control char in a regex literal is banned. */
const ANSI_SGR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')

/**
 * One readable line for an error, ANSI stripped. A Rolldown failure is a multi-line colored frame
 * whose first line is only a header (`Build failed with 1 error:`), so a header ending in `:` takes
 * the next line too (`[PARSE_ERROR] Unexpected token`).
 */
export function summarizeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  const lines = text
    .replaceAll(ANSI_SGR, '')
    .split('\n')
    .map((l) => l.trim())
  const [head, next] = lines.filter((line) => line !== '')
  if (head === undefined) return 'unknown error'
  return head.endsWith(':') && next !== undefined ? `${head} ${next}` : head
}
