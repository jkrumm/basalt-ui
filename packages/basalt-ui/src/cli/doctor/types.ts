/**
 * What every `doctor` check shares: the result shape, the context a run builds once, and the small
 * readers the checks have in common. A check is pass, fail or SKIPPED; a check that cannot run
 * throws `Skip`, which the runner prints as SKIPPED and counts as a failure (invariant 2).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

import type { Manifest, Profile } from '../manifest'
import type { RunLint } from '../../lint/weakened'

export type Status = 'pass' | 'fail' | 'skipped'
export type Outcome = { status: Status; detail: string }
export type Result = Outcome & { id: number; name: string }

/** Test seams; every default is the real thing. */
export type DoctorOptions = {
  /** Shipped-source root; defaults to this package. */
  pkgRoot?: string
  runLint?: RunLint
  /** The default remote branch ref for the budget ratchet; `null` skips it. */
  baseRef?: string | null
  /** The installed oxlint version; `null` means "could not be read". */
  installedOxlint?: string | null
}

export type Ctx = {
  /** The install root: the directory holding `.basalt/manifest.json`. */
  root: string
  pkgRoot: string
  /** The manifest; null when it is missing or does not parse (`manifestError` says why). */
  manifest: Manifest | null
  manifestError: string | null
  options: DoctorOptions
}

export type Check = { id: number; name: string; run: (ctx: Ctx) => Outcome | Promise<Outcome> }

/** Thrown by a check that cannot run: it prints SKIPPED, never a pass. */
export class Skip extends Error {}

export const pass = (detail: string): Outcome => ({ status: 'pass', detail })
export const fail = (detail: string): Outcome => ({ status: 'fail', detail })

/** Fails with every finding, or passes with `ok` when there are none. */
export const verdictOf = (findings: readonly string[], ok: string): Outcome =>
  findings.length === 0 ? pass(ok) : fail(findings.join('; '))

/** The manifest, or a SKIPPED check: nothing past check 1 can run without one. */
export function need(ctx: Ctx): Manifest {
  if (ctx.manifest === null) {
    throw new Skip(`no usable ${ctx.manifestError ?? '.basalt/manifest.json'}`)
  }
  return ctx.manifest
}

export const PROFILE_RANK: Readonly<Record<Profile, number>> = {
  tokens: 0,
  bridge: 1,
  parts: 2,
  app: 3,
}

/** A declared root as a clean relative path (`./src/` -> `src`, the root itself -> `.`). */
export const cleanRoot = (raw: string): string =>
  raw.replace(/^(?:\.\/)+/, '').replace(/\/+$/, '') || '.'

/** Declared roots with their profile, `src` at the manifest profile when none are declared. */
export function rootsOf(manifest: Manifest): [string, Profile][] {
  const declared = Object.entries(manifest.roots).map(([r, p]): [string, Profile] => [
    cleanRoot(r),
    p,
  ])
  return declared.length > 0 ? declared : [['src', manifest.profile]]
}

/** Roots that run the oxlint preset: every one above `tokens`. */
export const lintRoots = (manifest: Manifest): string[] =>
  rootsOf(manifest)
    .filter(([, profile]) => profile !== 'tokens')
    .map(([root]) => root)

const SKIPPED_DIRS = new Set(['node_modules', 'dist', '.git', '.basalt', '.claude', 'coverage'])

/** Files under `dir` matching `pattern`, as paths relative to `base`, sorted; no vendored trees. */
export function filesUnder(base: string, dir: string, pattern: RegExp): string[] {
  const start = resolve(base, dir)
  if (!existsSync(start)) return []
  return readdirSync(start, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && pattern.test(e.name))
    .map((e) => relative(base, join(e.parentPath, e.name)).split('\\').join('/'))
    .filter((rel) => !rel.split('/').some((part) => SKIPPED_DIRS.has(part)))
    .toSorted()
}

/** Every file under the declared roots matching `pattern`, relative to the install root. */
export function rootFiles(ctx: Ctx, manifest: Manifest, pattern: RegExp): string[] {
  const generated = new Set(manifest.tokens.map((t) => t.out))
  const seen = new Set<string>()
  for (const [root] of rootsOf(manifest)) {
    for (const file of filesUnder(ctx.root, root, pattern)) {
      if (!generated.has(file)) seen.add(file)
    }
  }
  return [...seen].toSorted()
}

export const readText = (root: string, rel: string): string | null => {
  try {
    return readFileSync(resolve(root, rel), 'utf8')
  } catch {
    return null
  }
}

export function readJson(root: string, rel: string): Record<string, unknown> | null {
  const text = readText(root, rel)
  if (text === null) return null
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** `MAJOR.MINOR.PATCH` compared numerically; a prerelease sorts below its release. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string): number[] =>
    (v.split(/[-+]/)[0] ?? '').split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [pa, pb] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  const pre = (v: string): number => (/^\d+\.\d+\.\d+-/.test(v) ? 0 : 1)
  return pre(a) - pre(b)
}

/** First run of digits in a semver range (`^7.0.15` -> 7), or null. */
export function majorOf(range: string | undefined): number | null {
  const match = typeof range === 'string' ? /\d+/.exec(range) : null
  return match === null ? null : Number(match[0])
}
