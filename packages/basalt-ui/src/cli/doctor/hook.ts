/**
 * Checks 8-9: the edit-time loop and its formatter fence. Check 8 is black-box: it reads the command
 * `settings.json` registers, runs it the way Claude Code does (from a subdirectory, with
 * `CLAUDE_PROJECT_DIR` set) on a seeded offender, and expects a finding back. Check 9 asks `oxfmt`
 * whether it would touch a managed path, because `oxfmt` reads no ignore file of its own.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { DEFAULT_OFFENDER, SEEDED_FILE } from '../../lint/weakened'
import { findBasaltInstall } from '../index'
import { renderManaged } from '../sync/render'
import { OXLINT_PRESET, STYLELINT_PRESET } from './wiring'
import { fail, lintRoots, need, pass, readJson, rootsOf, Skip, verdictOf } from './types'
import type { Check } from './types'

export const SETTINGS_PATH = '.claude/settings.json'
const SHIM = '.basalt/hook.mjs'

/** The settings event each shim argument is registered under. */
const EVENTS = [
  ['PostToolUse', 'post-edit'],
  ['Stop', 'stop'],
  ['PreToolUse', 'pre-edit'],
] as const

/** The tail of the wrapped command: a failed shim exits 2 and says so, never fails open. */
const WRAPPED_TAIL = /;\s*s=\$\?;\s*case \$s in 0\|2\) exit \$s;; esac;/

/** Every command registered under `event` whose text names the shim. */
function shimCommands(settings: Record<string, unknown>, event: string): string[] {
  const hooks = settings['hooks'] as Record<string, unknown> | undefined
  const entries = hooks?.[event]
  if (!Array.isArray(entries)) return []
  return entries
    .flatMap((entry: { hooks?: unknown }) => (Array.isArray(entry?.hooks) ? entry.hooks : []))
    .flatMap((hook: { command?: unknown }) =>
      typeof hook?.command === 'string' && hook.command.includes(SHIM) ? [hook.command] : [],
    )
}

/** The bin `package.json` declares, as a file that exists. */
function binResolves(root: string): string | null {
  const install = findBasaltInstall(root)
  if (install.dir === null) return 'basalt-ui does not resolve from here: run `bun install`'
  const bin = readJson(install.dir, 'package.json')?.['bin']
  const target =
    typeof bin === 'string'
      ? bin
      : typeof bin === 'object' && bin !== null
        ? (bin as Record<string, string>)['basalt-ui']
        : undefined
  return target !== undefined && existsSync(resolve(install.dir, target))
    ? null
    : `the basalt-ui bin does not exist in ${install.dir}: run \`bun install\``
}

const check8 = (name: string): Check => ({
  id: 8,
  name,
  run: (ctx) => {
    const manifest = need(ctx)
    if (lintRoots(manifest).length === 0)
      return pass('no declared root runs lint, so no hook is required')
    const settings = readJson(ctx.root, SETTINGS_PATH)
    if (settings === null)
      return fail(`${SETTINGS_PATH} is missing or not JSON: run \`basalt-ui sync\``)
    const findings: string[] = []
    let probe: string | null = null
    for (const [event, arg] of EVENTS) {
      const commands = shimCommands(settings, event)
      const wrapped = commands.find((c) => c.includes(`${SHIM}" ${arg}`) && WRAPPED_TAIL.test(c))
      if (wrapped === undefined) {
        findings.push(
          commands.length === 0
            ? `${event} registers no ${SHIM} ${arg} hook`
            : `${event} registers the shim bare: it fails open when the shim does not run`,
        )
      } else if (arg === 'post-edit') probe = wrapped
    }
    const bin = binResolves(ctx.root)
    if (bin !== null) findings.push(bin)
    if (findings.length > 0 || probe === null) return verdictOf(findings, '')

    const [root = '.'] = lintRoots(manifest)
    const sub = resolve(ctx.root, rootsOf(manifest).find(([r]) => r !== '.')?.[0] ?? '.basalt')
    const seeded = resolve(ctx.root, root, SEEDED_FILE)
    if (existsSync(seeded))
      return fail(`${root}/${SEEDED_FILE} already exists; remove it and run again`)
    try {
      writeFileSync(seeded, DEFAULT_OFFENDER.content, 'utf8')
      const event = JSON.stringify({
        hook_event_name: 'PostToolUse',
        tool_name: 'Write',
        tool_input: { file_path: seeded },
        cwd: sub,
        session_id: 'basalt-doctor',
      })
      const run = spawnSync('/bin/sh', ['-c', probe], {
        cwd: sub,
        env: { ...process.env, CLAUDE_PROJECT_DIR: ctx.root },
        input: event,
        encoding: 'utf8',
        timeout: 120_000,
      })
      if (run.error !== undefined)
        throw new Skip(`could not run the registered command: ${run.error.message}`)
      const out = `${run.stdout}${run.stderr}`.trim()
      if (run.status === 2 && FINDING.test(out)) {
        return pass(
          `the seeded offender returned a finding from ${sub.slice(ctx.root.length + 1) || '.'}`,
        )
      }
      return fail(
        run.status === 0
          ? 'the seeded offender passed the hook (exit 0): the guard is off'
          : `the hook exited ${run.status} with no finding: ${out.split('\n').find((l) => l.startsWith('basalt hook:')) ?? (out.slice(-200) || '(no output)')}`,
      )
    } finally {
      rmSync(seeded, { force: true })
    }
  },
})

/** A finding line: `src/pages/a.tsx:41 basalt/class-policy: ...` (guardrails section 8). */
const FINDING = /:\d+\s+basalt\/[a-z][\w-]*:/

/** Resolves `node_modules/.bin/<name>` from `dir` upward. */
function findBin(dir: string, name: string): string | null {
  for (let at = dir; ; at = dirname(at)) {
    const path = resolve(at, 'node_modules/.bin', name)
    if (existsSync(path)) return path
    if (dirname(at) === at) return null
  }
}

/** Paths the formatter must not touch, each as a probe file that is unformatted on purpose. */
const PROBE_DIRS = ['.basalt', '.claude/rules', '.claude/skills', '.claude/agents'] as const
const UNFORMATTED = '{"a":1,\n"b":   2}\n'

const check9 = (name: string): Check => ({
  id: 9,
  name,
  run: (ctx) => {
    const manifest = need(ctx)
    const oxfmt = findBin(ctx.root, 'oxfmt')
    if (oxfmt === null)
      throw new Skip('oxfmt does not resolve, so the formatter fence cannot be probed')
    // 0: formatted (not ignored, and cannot tell), 1: listed (not ignored), 2: nothing to format
    // because every target was ignored. Only an ignored path is covered.
    const ignored = (path: string): boolean => {
      const run = spawnSync(oxfmt, ['--list-different', path], { cwd: ctx.root, encoding: 'utf8' })
      if (run.error !== undefined) throw new Skip(`oxfmt could not run: ${run.error.message}`)
      return run.status === 2 && /Expected at least one target/.test(`${run.stdout}${run.stderr}`)
    }
    const findings: string[] = []
    const layer = renderManaged(ctx.pkgRoot, manifest).length > 0
    for (const dir of PROBE_DIRS.filter((d) => layer || d === '.basalt')) {
      const probe = `${dir}/basalt-doctor-probe.json`
      const made: string[] = []
      for (let at = resolve(ctx.root, dir); !existsSync(at); at = dirname(at)) made.push(at)
      try {
        mkdirSync(resolve(ctx.root, dir), { recursive: true })
        writeFileSync(resolve(ctx.root, probe), UNFORMATTED, 'utf8')
        if (!ignored(probe)) findings.push(`${dir}/ is not in the formatter ignore list`)
      } finally {
        rmSync(resolve(ctx.root, probe), { force: true })
        for (const dirPath of made) {
          try {
            rmdirSync(dirPath)
          } catch {
            // not empty: someone else's file, leave it
          }
        }
      }
    }
    for (const preset of [OXLINT_PRESET, STYLELINT_PRESET]) {
      if (existsSync(resolve(ctx.root, preset)) && !ignored(preset)) {
        findings.push(`${preset} is not in the formatter ignore list`)
      }
    }
    return verdictOf(
      findings.map((f) => `${f}: add it to ignorePatterns in .oxfmtrc.json (or .prettierignore)`),
      'oxfmt skips .basalt/, the presets and the managed .claude paths',
    )
  },
})

export const hookChecks: Check[] = [check8('hook'), check9('formatter-ignore')]
