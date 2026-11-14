/**
 * The weakened-guard checks `doctor` calls (guardrails section 7, "doctor weakened-guard checks").
 * Reading config keys misses the cheap bypasses (`ignorePatterns`, `.oxlintignore`, per-glob
 * `overrides`), so check 1 is behavioural: a seeded offender is written into every declared root,
 * linted, and removed in a `finally`; it must fire. Checks 2-5 are the cheap static ones.
 *
 * A required check that cannot run is `skipped`, never `passed`; `doctor` fails on `skipped`.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, relative, resolve } from 'node:path'

import { BUDGET_PATH, CEILINGS, parseBudget } from '../cli/budget'
import { parseJsonc } from '../cli/source-text'

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
const MANAGED_PREFIXES = ['basalt/', 'shadcn/'] as const

/** A hex literal is `colour-literal`, the one form that runs at every profile that lints a root. */
export const DEFAULT_OFFENDER: Offender = {
  // theme-allow raw-hex — the seeded offender is a hex literal on purpose
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

/** The default runner (`bin` is an override for a non-PATH install): `oxlint --format json <file>` from `cwd`, picking up `.oxlintrc.json`. */
export const oxlintRunner =
  (bin = 'oxlint'): RunLint =>
  async (file, cwd) => {
    // oxlint reads `.eslintignore` by default; a root's `.oxlintignore` only counts when the lint
    // verb is told to read it, so the check lints the way that verb does.
    const ignore = existsSync(resolve(cwd, '.oxlintignore'))
      ? ['--ignore-path', '.oxlintignore']
      : []
    const proc = Bun.spawn([bin, '--format', 'json', ...ignore, relative(cwd, file)], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [out, err] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
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

async function seededOffender(
  dir: string,
  roots: readonly string[],
  runLint: RunLint,
  offender: Offender,
): Promise<WeakenedResult> {
  const result = verdict(1, 'seeded-offender')
  if (roots.length === 0) return result('skipped', 'no declared root to seed')
  const dead: string[] = []
  for (const root of roots) {
    const file = resolve(dir, root, SEEDED_FILE)
    if (existsSync(file)) {
      return result('failed', `${root}/${SEEDED_FILE} already exists; remove it and run again`)
    }
    try {
      writeFileSync(file, offender.content, 'utf8')
      const fired = (await runLint(file, dir)).map(normalizeId)
      if (!fired.some(offender.fired)) dead.push(`${root}: the seeded offender did not fire`)
    } catch (error) {
      dead.push(`${root}: lint failed (${error instanceof Error ? error.message : String(error)})`)
    } finally {
      rmSync(file, { force: true })
    }
  }
  return dead.length > 0
    ? result(
        'failed',
        `${dead.join('; ')}; extends, jsPlugins, ignorePatterns or .oxlintignore dropped the guard`,
      )
    : result('passed', `the seeded offender fired in ${roots.length} root(s)`)
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

function managedIds(config: Config | string): WeakenedResult {
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
          .filter((id) => MANAGED_PREFIXES.some((p) => id.startsWith(p)))
          .map((id) => `${id} in ${where}`)
      : [],
  )
  return hits.length > 0
    ? result(
        'failed',
        `managed ids set by hand: ${hits.join(', ')}; waive with a reasoned directive`,
      )
    : result('passed', 'no managed id in rules or overrides')
}

function oxlintPin(pin: string, installed: string | null): WeakenedResult {
  const result = verdict(4, 'oxlint-pin')
  if (installed === null) return result('skipped', 'the installed oxlint version could not be read')
  return installed === pin
    ? result('passed', `oxlint ${installed} equals the preset pin`)
    : result('failed', `oxlint ${installed} is not the preset pin ${pin}`)
}

function budgetRatchet(dir: string, baseRef: string | null | undefined): WeakenedResult {
  const result = verdict(5, 'budget-ratchet')
  if (!baseRef) return result('skipped', 'no base ref to compare the budget against')
  // A git that cannot start is a check that cannot run: skipped, never a rejected call.
  const git = (...args: string[]) => {
    try {
      return Bun.spawnSync(['git', '-C', dir, ...args], { stderr: 'ignore' })
    } catch {
      return { exitCode: 127, stdout: Buffer.alloc(0) }
    }
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
  const above = CEILINGS.filter((k) => current.budget[k] > base.budget[k]).map(
    (k) => `${k} ${current.budget[k]} > ${base.budget[k]} at ${baseRef}`,
  )
  return above.length > 0
    ? result(
        'failed',
        `${above.join(', ')}; a ceiling only goes up with \`basalt-ui eject --raise\``,
      )
    : result('passed', `${CEILINGS.join(', ')} are within ${baseRef}`)
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
      input.runLint ?? oxlintRunner(),
      input.offender ?? DEFAULT_OFFENDER,
    ),
    extendsPreset(config),
    managedIds(config),
    oxlintPin(
      pin,
      input.installedOxlint === undefined ? installedOxlintVersion(dir) : input.installedOxlint,
    ),
    budgetRatchet(dir, baseRef),
  ]
}
