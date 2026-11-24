/**
 * The weakened-guard checks `doctor` calls (guardrails section 7, "doctor weakened-guard checks").
 * Reading config keys misses the cheap bypasses (`ignorePatterns`, `.oxlintignore`, per-glob
 * `overrides`), so check 1 is behavioural: a seeded offender is written into every declared root,
 * linted, and removed in a `finally`; it must fire. Checks 2-5 are the cheap static ones.
 *
 * A required check that cannot run is `skipped`, never `passed`; `doctor` fails on `skipped`.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'

import { BUDGET_PATH, CEILINGS, parseBudget, raiseCommand } from '../cli/budget'
import type { Budget } from '../cli/budget'
import { filesUnder, rootsOf } from '../cli/doctor/types'
import { MANIFEST_PATH, parseManifest } from '../cli/manifest'
import { generatedRouteTreeOption } from '../cli/router-wiring'
import { parseJsonc } from '../cli/source-text'
import { findBin } from './bin'
import { findBlanketDisables } from './blanket-disable'
import { isManagedRuleId } from './preset'

export type WeakenedStatus = 'passed' | 'failed' | 'skipped'

export type WeakenedResult = {
  check: 1 | 2 | 3 | 4 | 5
  name: 'seeded-offender' | 'extends' | 'managed-ids' | 'oxlint-pin' | 'budget-ratchet'
  status: WeakenedStatus
  detail: string
}

/** Lints one file and returns the rule ids it fired, as `basalt/<id>` or oxlint's `basalt(<id>)`. */
export type RunLint = (file: string, cwd: string) => Promise<readonly string[]> | readonly string[]

/** What the seeded file holds and which fired id proves the guard is live. */
export type Offender = { content: string; fired: (id: string) => boolean }

export const SEEDED_FILE = '__basalt_seeded_offender__.tsx'
export const PRESET_FILE = '.oxlintrc.basalt.json'
const OXLINTRC = '.oxlintrc.json'
const SCRIPT_FILE = /\.[cm]?[jt]sx?$/

/** A hex literal is `colour-literal`, the one form that runs at every profile that lints a root. */
export const DEFAULT_OFFENDER: Offender = {
  content: "export const seeded = '#ff0000'\n",
  fired: (id) => id === 'basalt/colour-literal',
}

export type WeakenedInput = {
  /** The install root: where `.oxlintrc.json` and `.basalt/` live. */
  dir: string
  /** Declared source roots, relative to `dir`. */
  roots: readonly string[]
  /** Injected; the default spawns oxlint with the consumer config. */
  runLint?: RunLint
  /** The default remote branch ref (`origin/main`); absent or null skips check 5. */
  baseRef?: string | null
  /** The refs looked for when `baseRef` is null: named in the ratchet's message. */
  triedRefs?: readonly string[]
  /** The exact oxlint version the preset pins. */
  oxlintPin: string
  /** The installed oxlint version; default asks `oxlint --version`. */
  installedOxlint?: string | null
  offender?: Offender
}

const verdict =
  (check: WeakenedResult['check'], name: WeakenedResult['name']) =>
  (status: WeakenedStatus, detail: string): WeakenedResult => ({ check, name, status, detail })

const normalizeId = (code: string): string => {
  const paren = /^([\w@-]+)\(([\w-]+)\)$/.exec(code)
  return paren ? `${paren[1]}/${paren[2]}` : code
}

/** `bin args` from `cwd` through node:child_process, so it runs under node and bun alike. */
function exec(
  bin: string,
  args: readonly string[],
  cwd: string,
): Promise<{ out: string; err: string }> {
  return new Promise((done, fail) => {
    const child = spawn(bin, args, { cwd })
    let out = ''
    let err = ''
    child.stdout.on('data', (chunk: Buffer) => (out += chunk.toString()))
    child.stderr.on('data', (chunk: Buffer) => (err += chunk.toString()))
    child.on('error', (error) => fail(new Error(`${bin} could not run: ${error.message}`)))
    child.on('close', () => done({ out, err }))
  })
}

/** The default runner (`bin` is an override for a non-PATH install): `oxlint --format json <file>` from `cwd`, picking up `.oxlintrc.json`. */
export const oxlintRunner =
  (bin = 'oxlint'): RunLint =>
  async (file, cwd) => {
    // oxlint reads `.eslintignore` by default; a root's `.oxlintignore` only counts when the lint
    // verb is told to read it, so the check lints the way that verb does.
    const ignore = existsSync(resolve(cwd, '.oxlintignore'))
      ? ['--ignore-path', '.oxlintignore']
      : []
    const { out, err } = await exec(bin, ['--format', 'json', ...ignore, relative(cwd, file)], cwd)
    // An ignored file is "no files found": nothing fired, which is the answer, not a failure.
    if (/No files found/.test(err + out)) return []
    let parsed: { diagnostics?: { code?: string }[] }
    try {
      parsed = JSON.parse(out) as typeof parsed
    } catch {
      throw new Error(`oxlint printed no JSON: ${(err || out).trim().slice(0, 200)}`)
    }
    return (parsed.diagnostics ?? []).flatMap((d) => (d.code ? [normalizeId(d.code)] : []))
  }

/** The runner `basalt-ui lint` would use: the project's own oxlint binary, never a bare PATH lookup. */
function projectRunner(dir: string, roots: readonly string[]): RunLint {
  const bin = findBin({ root: dir, roots: roots.map((r) => [r, 'app'] as const) }, 'oxlint')
  return oxlintRunner(bin ?? undefined)
}

const isDirectory = (path: string): boolean => {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** Every directory under `root` that holds a source file, the root itself always (relative to `dir`). */
function seedDirs(dir: string, root: string): string[] {
  const dirs = new Set([root])
  for (const file of filesUnder(dir, root, SCRIPT_FILE)) dirs.add(dirname(file))
  return [...dirs].toSorted()
}

/** Which config switched the guard off in `seedDir`, as far as the files say. */
function blame(dir: string, root: string, seedDir: string): string {
  for (let at = seedDir; at !== dirname(root) && at !== '.'; at = dirname(at)) {
    if (existsSync(resolve(dir, at, OXLINTRC))) return `${at}/${OXLINTRC} holds the config there`
    if (at === root) break
  }
  const config = readConfig(dir)
  if (typeof config !== 'string' && asStrings(config['ignorePatterns']).length > 0) {
    return `${OXLINTRC} ignorePatterns`
  }
  if (existsSync(resolve(dir, '.oxlintignore'))) return '.oxlintignore'
  return 'extends, jsPlugins or a per-glob override'
}

/** The refs the ratchet looks for, in order; `origin/HEAD` is git's default remote branch. */
export const BASE_REF_CANDIDATES = ['origin/HEAD', 'origin/main', 'origin/master'] as const

/** Git's default remote branch, `origin/main` or `origin/master` when nothing says. */
export function defaultBaseRef(root: string): string | null {
  const run = spawnSync(
    'git',
    ['-C', root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
    {
      encoding: 'utf8',
    },
  )
  if (run.status === 0 && run.stdout.trim() !== '') return run.stdout.trim()
  for (const ref of BASE_REF_CANDIDATES.slice(1)) {
    const probe = spawnSync('git', ['-C', root, 'rev-parse', '--verify', '--quiet', ref], {
      encoding: 'utf8',
    })
    if (probe.status === 0) return ref
  }
  return null
}

/** Declared roots of the manifest committed at `ref`, or null when there is none to read. */
function rootsAtRef(dir: string, ref: string): string[] | null {
  const shown = spawnSync('git', ['-C', dir, 'show', `${ref}:./${MANIFEST_PATH}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const read = shown.status === 0 ? parseManifest(shown.stdout) : null
  return read !== null && 'manifest' in read ? rootsOf(read.manifest).map(([r]) => r) : null
}

const covers = (outer: string, inner: string): boolean =>
  outer === '.' || outer === inner || inner.startsWith(`${outer}/`)

/** A root that is a file, and a root declared at `baseRef` that is still on disk but no longer covered. */
export function rootFindings(input: {
  dir: string
  roots: readonly string[]
  baseRef: string | null
}): string[] {
  const { dir, roots, baseRef } = input
  const findings = roots.flatMap((root) =>
    existsSync(resolve(dir, root)) && !isDirectory(resolve(dir, root))
      ? [`${root} is a file: a declared root is a directory, so the guard would scan one file`]
      : [],
  )
  for (const old of baseRef === null ? [] : (rootsAtRef(dir, baseRef) ?? [])) {
    if (existsSync(resolve(dir, old)) && !roots.some((r) => covers(r, old))) {
      findings.push(
        `root ${old} was declared at ${baseRef} and is no longer covered; the files under it are unlinted`,
      )
    }
  }
  return findings
}

async function seededOffender(
  dir: string,
  roots: readonly string[],
  runLint: RunLint,
  offender: Offender,
): Promise<WeakenedResult> {
  const result = verdict(1, 'seeded-offender')
  if (roots.length === 0) return result('skipped', 'no declared root to seed')
  const dead: string[] = []
  let seeded = 0
  for (const root of roots) {
    if (!isDirectory(resolve(dir, root))) {
      dead.push(`${root}: a declared root must be a directory, not a file or a missing path`)
      continue
    }
    for (const seedDir of seedDirs(dir, root)) {
      const file = resolve(dir, seedDir, SEEDED_FILE)
      if (existsSync(file)) {
        return result('failed', `${seedDir}/${SEEDED_FILE} already exists; remove it and run again`)
      }
      seeded += 1
      try {
        writeFileSync(file, offender.content, 'utf8')
        const fired = (await runLint(file, dir)).map(normalizeId)
        if (!fired.some(offender.fired)) {
          dead.push(`${seedDir}: the guard is off here (${blame(dir, root, seedDir)})`)
        }
      } catch (error) {
        dead.push(
          `${seedDir}: lint failed (${error instanceof Error ? error.message : String(error)})`,
        )
      } finally {
        rmSync(file, { force: true })
      }
    }
  }
  return dead.length > 0
    ? result('failed', dead.join('; '))
    : result(
        'passed',
        `the seeded offender fired in ${seeded} directory(ies) of ${roots.length} root(s)`,
      )
}

type Config = Record<string, unknown>

const asStrings = (v: unknown): string[] =>
  typeof v === 'string'
    ? [v]
    : Array.isArray(v)
      ? v.filter((s): s is string => typeof s === 'string')
      : []

const isRecord = (v: unknown): v is Config =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

function readConfig(dir: string): Config | string {
  const path = resolve(dir, OXLINTRC)
  if (!existsSync(path)) return `${OXLINTRC} is missing`
  return parseJsonc(readFileSync(path, 'utf8')) ?? `${OXLINTRC} does not parse as JSON or JSONC`
}

function extendsPreset(config: Config | string): WeakenedResult {
  const result = verdict(2, 'extends')
  if (typeof config === 'string') return result('failed', config)
  const ok = asStrings(config['extends']).some((p) => basename(p) === PRESET_FILE)
  return ok
    ? result('passed', `${OXLINTRC} extends ${PRESET_FILE}`)
    : result(
        'failed',
        `${OXLINTRC} extends does not name ${PRESET_FILE}; \`basalt-ui sync\` writes it`,
      )
}

export const GENERATED_TREE = /^routeTree\.gen\.[cm]?[jt]sx?$/
/** A generator's output (openapi-ts, orval, the router): rewritten on the next run, so it cannot carry a line waiver. */
const GENERATED_NAME = /\.gen\.[cm]?[jt]sx?$/

/** The one rule for a generated file, shared by doctor's weakened-config check and the editor hook's pre-edit. */
export const isGeneratedFile = (file: string): boolean => GENERATED_NAME.test(basename(file))

/** A gitignore-style glob (`*`, `**`, a bare name at any depth, a directory) as a test on a root-relative path. */
export function ignoreMatcher(pattern: string): (path: string) => boolean {
  const trimmed = pattern.replace(/^\.\//, '').replace(/\/$/, '')
  // A slash before the end anchors the pattern to the config's directory; `generated/` does not.
  const anchored = trimmed.includes('/')
  const body = trimmed.replace(/^\//, '')
  const source = body
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*\//g, '<<DEEP_DIR>>')
    .replace(/\*\*/g, '<<DEEP>>')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '[^/]')
    .replace(/<<DEEP_DIR>>/g, '(?:.*/)?')
    .replace(/<<DEEP>>/g, '.*')
  // The pattern names the path itself or a directory above it.
  const regex = new RegExp(`^${anchored ? '' : '(?:.*/)?'}${source}(?:/.*)?$`)
  return (path) => regex.test(path)
}

/** The patterns of an ignore file's text: no blanks, comments or negations. */
export function ignoreFilePatterns(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#') && !line.startsWith('!'))
}

export const STYLELINTIGNORE = '.stylelintignore'
const STYLE_SOURCE = /\.(?:css|astro|mdx|html)$/

/** The source files (scripts, or stylesheets) under the declared roots that any of `patterns` names; a generated file (`*.gen.*`) is never counted: it goes into `ignorePatterns`. */
export function rootFilesNamedBy(
  dir: string,
  roots: readonly string[],
  patterns: readonly string[],
  kind: 'script' | 'style',
): string[] {
  const matchers = patterns.map(ignoreMatcher)
  const pattern = kind === 'script' ? SCRIPT_FILE : STYLE_SOURCE
  const files = new Set(roots.flatMap((root) => filesUnder(dir, root, pattern)))
  return [...files]
    .filter((file) => !isGeneratedFile(file))
    .filter((file) => matchers.some((matches) => matches(file)))
    .toSorted()
}

/** The stylesheets under the declared roots that `.stylelintignore` names, which stylelint run on its own then skips. */
function styleSheetsIgnored(dir: string, roots: readonly string[]): string[] {
  const path = resolve(dir, STYLELINTIGNORE)
  if (!existsSync(path)) return []
  return rootFilesNamedBy(dir, roots, ignoreFilePatterns(readFileSync(path, 'utf8')), 'style')
}

/** What the lint run leaves alone: the config's `ignorePatterns`, `.oxlintignore`, and the router's generated tree. */
function ignoredByLint(dir: string, config: Config | string): (file: string) => boolean {
  const patterns = typeof config === 'string' ? [] : asStrings(config['ignorePatterns'])
  const ignoreFile = resolve(dir, '.oxlintignore')
  if (existsSync(ignoreFile)) patterns.push(...ignoreFilePatterns(readFileSync(ignoreFile, 'utf8')))
  const matchers = patterns.map(ignoreMatcher)
  const named = generatedRouteTreeOption(dir)
  return (file) =>
    GENERATED_TREE.test(basename(file)) ||
    file === named ||
    matchers.some((matches) => matches(file))
}

/** File-level directives under the declared roots that leave `waiver-needs-reason` unable to report. */
function blanketDisables(dir: string, roots: readonly string[], config: Config | string): string[] {
  const ignored = ignoredByLint(dir, config)
  const files = new Set(roots.flatMap((root) => filesUnder(dir, root, SCRIPT_FILE)))
  return [...files]
    .filter((file) => !ignored(file))
    .toSorted()
    .flatMap((file) => {
      let source: string
      try {
        source = readFileSync(resolve(dir, file), 'utf8')
      } catch {
        return []
      }
      return findBlanketDisables(source).map((d) => `${file}:${d.line} (${d.reach})`)
    })
}

/** `.oxlintrc.json` files under the declared roots (below the install root) that do not extend the preset. */
function nestedConfigsWithoutPreset(dir: string, roots: readonly string[]): string[] {
  const files = new Set(roots.flatMap((root) => filesUnder(dir, root, /^\.oxlintrc\.json$/)))
  return [...files].toSorted().filter((file) => {
    if (file === OXLINTRC) return false
    try {
      const config = parseJsonc(readFileSync(resolve(dir, file), 'utf8'))
      return !asStrings(config?.['extends']).some((p) => basename(p) === PRESET_FILE)
    } catch {
      return true
    }
  })
}

function managedIds(
  config: Config | string,
  dir: string,
  roots: readonly string[],
): WeakenedResult {
  const result = verdict(3, 'managed-ids')
  if (typeof config === 'string') return result('failed', config)
  const tables: [string, unknown][] = [['rules', config['rules']]]
  const overrides = config['overrides']
  if (Array.isArray(overrides)) {
    overrides.forEach((o, i) =>
      tables.push([`overrides[${i}].rules`, isRecord(o) ? o['rules'] : undefined]),
    )
  }
  const hits = tables.flatMap(([where, rules]) =>
    isRecord(rules)
      ? Object.keys(rules)
          .filter(isManagedRuleId)
          .map((id) => `${id} in ${where}`)
      : [],
  )
  const blanket = blanketDisables(dir, roots, config)
  const nested = nestedConfigsWithoutPreset(dir, roots)
  const styleIgnored = styleSheetsIgnored(dir, roots)
  const problems: string[] = []
  if (styleIgnored.length > 0) {
    const shown = styleIgnored.slice(0, 3).join(', ')
    const more = styleIgnored.length > 3 ? ` and ${styleIgnored.length - 3} more` : ''
    problems.push(
      `${STYLELINTIGNORE} names stylesheets under a declared root: ${shown}${more}; \`basalt-ui lint\` ignores the file, but stylelint run on its own skips them: delete it`,
    )
  }
  if (nested.length > 0) {
    problems.push(
      `nested config without ${PRESET_FILE} in extends: ${nested.join(', ')}; it replaces the root config for its subtree`,
    )
  }
  if (hits.length > 0) {
    problems.push(`managed ids set by hand: ${hits.join(', ')}; waive with a reasoned directive`)
  }
  if (blanket.length > 0) {
    problems.push(
      `file-level disable silences waiver-needs-reason: ${blanket.join(', ')}; waive the line with a reason, declare the path in manifest.deepRender and name colour-literal, shadcn/no-inline-styles or raw-scroll, or, for a generated file, add its path to ignorePatterns in ${OXLINTRC}`,
    )
  }
  return problems.length > 0
    ? result('failed', problems.join('; '))
    : result('passed', 'no managed id in rules or overrides, no file-level blanket disable')
}

function oxlintPin(pin: string, installed: string | null): WeakenedResult {
  const result = verdict(4, 'oxlint-pin')
  if (installed === null) return result('skipped', 'the installed oxlint version could not be read')
  return installed === pin
    ? result('passed', `oxlint ${installed} equals the preset pin`)
    : result('failed', `oxlint ${installed} is not the preset pin ${pin}`)
}

/** A ceiling above the base is a raise only when a row the base lacks names the field, the new ceiling and a consumer. */
function raisedByRow(current: Budget, base: Budget, field: (typeof CEILINGS)[number]): boolean {
  const known = new Set(base.raises.map((r) => JSON.stringify(r)))
  return current.raises.some(
    (r) =>
      !known.has(JSON.stringify(r)) &&
      r['field'] === field &&
      r['to'] === current[field] &&
      typeof r['consumer'] === 'string' &&
      r['consumer'].trim() !== '',
  )
}

/** A `.git` entry (a directory, or a worktree's file) at `dir` or above it. */
function hasGitEntry(dir: string): boolean {
  for (let at = resolve(dir); ; at = dirname(at)) {
    if (existsSync(resolve(at, '.git'))) return true
    if (dirname(at) === at) return false
  }
}

function budgetRatchet(
  dir: string,
  baseRef: string | null | undefined,
  tried: readonly string[],
): WeakenedResult {
  const result = verdict(5, 'budget-ratchet')
  // A git that cannot start is a check that cannot run: skipped, never a rejected call.
  const git = (...args: string[]) => {
    const run = spawnSync('git', ['-C', dir, ...args], { stdio: ['ignore', 'pipe', 'ignore'] })
    return { exitCode: run.error === undefined ? run.status : 127, stdout: run.stdout ?? '' }
  }
  if (!baseRef) {
    const named = tried.length === 0 ? 'none given' : tried.join(', ')
    // A repo with no remote has no base to ratchet against: nothing can have been raised yet. A
    // remote with no resolvable base (a shallow or single-branch checkout) must fail, not pass.
    const remotes = git('remote')
    if (git('rev-parse', '--git-dir').exitCode === 128 && !hasGitEntry(dir)) {
      return result(
        'passed',
        `no git repo here (tried ${named}), so no ceiling can have been raised; \`git init\` and a first commit start the ratchet`,
      )
    }
    if (remotes.exitCode === 0 && String(remotes.stdout).trim() === '') {
      return result(
        'passed',
        `no base ref resolves (tried ${named}) and the repo has no remote, so no ceiling can have been raised; the ratchet runs once it has one`,
      )
    }
    return result('skipped', `no base ref resolves (tried ${named}); fetch the base branch first`)
  }
  if (git('rev-parse', '--verify', '--quiet', `${baseRef}^{commit}`).exitCode !== 0) {
    return result('skipped', `base ref ${baseRef} does not resolve; fetch it first`)
  }
  const path = resolve(dir, BUDGET_PATH)
  if (!existsSync(path)) return result('failed', `${BUDGET_PATH} is missing`)
  const current = parseBudget(readFileSync(path, 'utf8'))
  if ('error' in current) return result('failed', current.error)
  const shown = git('show', `${baseRef}:./${BUDGET_PATH}`)
  if (shown.exitCode !== 0)
    return result('passed', `${BUDGET_PATH} has no copy at ${baseRef} (first landing)`)
  const base = parseBudget(shown.stdout.toString())
  if ('error' in base) return result('failed', `${baseRef}: ${base.error}`)
  const above = CEILINGS.filter(
    (k) => current.budget[k] > base.budget[k] && !raisedByRow(current.budget, base.budget, k),
  )
  return above.length > 0
    ? result(
        'failed',
        `${above.map((k) => `${k} ${current.budget[k]} > ${base.budget[k]} at ${baseRef}`).join(', ')}; a ceiling only goes up with ${above.map(raiseCommand).join(' and ')}`,
      )
    : result(
        'passed',
        `${CEILINGS.join(', ')} are within ${baseRef}${
          current.budget.waivers > base.budget.waivers
            ? `; waivers grew ${base.budget.waivers} -> ${current.budget.waivers} since ${baseRef} (a record that follows the count)`
            : ''
        }`,
      )
}

/** The first `node_modules/<rel>` found from `dir` upward, the way the install resolves it. */
function findUp(dir: string, rel: string): string | null {
  for (let at = dir; ; at = dirname(at)) {
    const path = resolve(at, 'node_modules', rel)
    if (existsSync(path)) return path
    if (dirname(at) === at) return null
  }
}

function installedOxlintVersion(dir: string): string | null {
  const manifest = findUp(dir, 'oxlint/package.json')
  if (manifest === null) return null
  try {
    const { version } = JSON.parse(readFileSync(manifest, 'utf8')) as { version?: unknown }
    return typeof version === 'string' ? version : null
  } catch {
    return null
  }
}

/** One result per check, in order 1 to 5. */
export async function checkWeakenedConfig(input: WeakenedInput): Promise<WeakenedResult[]> {
  const { dir, roots, baseRef, oxlintPin: pin } = input
  const config = readConfig(dir)
  return [
    await seededOffender(
      dir,
      roots,
      input.runLint ?? projectRunner(dir, roots),
      input.offender ?? DEFAULT_OFFENDER,
    ),
    extendsPreset(config),
    managedIds(config, dir, roots),
    oxlintPin(
      pin,
      input.installedOxlint === undefined ? installedOxlintVersion(dir) : input.installedOxlint,
    ),
    budgetRatchet(dir, baseRef, input.triedRefs ?? BASE_REF_CANDIDATES),
  ]
}
