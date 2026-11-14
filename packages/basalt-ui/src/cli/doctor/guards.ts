/**
 * Checks 10-11: the committed token sheets and the guard budgets. Check 10 re-runs `tokens:css`
 * with each recorded flag set; check 11 counts ejects, waivers and escapes against
 * `.basalt/budget.json`, verifies the ejected files, runs the weakened-config check from the
 * guardrail concept and reads DESIGN.md.
 */
import { spawnSync } from 'node:child_process'

import { checkWeakenedConfig } from '../../lint/weakened'
import type { WeakenedResult } from '../../lint/weakened'
import { BUDGET_PATH, countBreaches, readBudget } from '../budget'
import { tokensCss } from '../tokens-css'
import { ejectFindings } from './eject'
import { OXLINT_PRESET } from './wiring'
import { fail, lintRoots, need, pass, readJson, readText, rootFiles, verdictOf } from './types'
import type { Check, Ctx, Outcome } from './types'

/** `tokensCss` with both streams captured: doctor prints its own line per check. */
function quietTokens(argv: string[], cwd: string): { code: number; text: string } {
  const saved = { log: console.log, error: console.error }
  let text = ''
  const sink = (...args: unknown[]): void => {
    text += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: tokensCss(argv, cwd), text: text.trim() }
  } finally {
    console.log = saved.log
    console.error = saved.error
  }
}

const check10 = (name: string): Check => ({
  id: 10,
  name,
  run: (ctx) => {
    const manifest = need(ctx)
    if (manifest.tokens.length === 0) {
      return manifest.profile === 'tokens'
        ? fail('profile tokens declares no `tokens` output in the manifest: nothing is checked')
        : pass('the manifest declares no committed token output')
    }
    const findings = manifest.tokens.flatMap((entry) => {
      const { code, text } = quietTokens([...entry.flags, '--out', entry.out, '--check'], ctx.root)
      return code === 0 ? [] : [`${entry.out}: ${text.split('\n')[0] || 'drifted'}`]
    })
    return verdictOf(findings, `${manifest.tokens.length} token output(s) match their flags`)
  },
})

const WAIVER = /oxlint-disable(?:-next-line)?\s+basalt\//g
const ESCAPE = /\b(?:col|chart|field|filterSlot)\.custom\b/g
const HEX_LITERAL = /#[0-9a-fA-F]{3,8}\b/
const REASONED = /\s(?:—|--|because)\s|reason:/i
const DESIGN_MAX_LINES = 150

function designFindings(ctx: Ctx): string[] {
  const manifest = need(ctx)
  const text = readText(ctx.root, 'DESIGN.md')
  if (text === null) {
    return manifest.profile === 'tokens' &&
      Object.values(manifest.roots).every((p) => p === 'tokens')
      ? []
      : ['DESIGN.md is missing: `basalt-ui init` seeds it']
  }
  const findings: string[] = []
  const lines = text.replace(/\n$/, '').split('\n')
  if (lines.length > DESIGN_MAX_LINES)
    findings.push(`DESIGN.md has ${lines.length} lines (max ${DESIGN_MAX_LINES})`)
  if (HEX_LITERAL.test(text))
    findings.push('DESIGN.md holds a hex literal: the palette is derived, name no value')
  if (/mantine/i.test(text)) findings.push('DESIGN.md mentions Mantine')
  const at = lines.findIndex((l) => /^##\s+Deviations\b/.test(l))
  if (at !== -1) {
    const section = lines.slice(at + 1)
    const end = section.findIndex((l) => /^##\s/.test(l))
    for (const line of end === -1 ? section : section.slice(0, end)) {
      if (/^\s*[-*]\s/.test(line) && !/none yet/i.test(line) && !REASONED.test(line)) {
        findings.push(`DESIGN.md deviation without a reason: "${line.trim().slice(0, 60)}"`)
      }
    }
  }
  return findings
}

/** Git's default remote branch, `origin/main` when nothing says. */
function defaultBaseRef(root: string): string | null {
  const run = spawnSync(
    'git',
    ['-C', root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'],
    {
      encoding: 'utf8',
    },
  )
  if (run.status === 0 && run.stdout.trim() !== '') return run.stdout.trim()
  for (const ref of ['origin/main', 'origin/master']) {
    const probe = spawnSync('git', ['-C', root, 'rev-parse', '--verify', '--quiet', ref], {
      encoding: 'utf8',
    })
    if (probe.status === 0) return ref
  }
  return null
}

async function weakened(ctx: Ctx): Promise<{ findings: string[]; skipped: string[] }> {
  const manifest = need(ctx)
  const roots = lintRoots(manifest)
  if (roots.length === 0) return { findings: [], skipped: [] }
  const settings = readJson(ctx.root, OXLINT_PRESET)?.['settings'] as
    | { basalt?: { pins?: { oxlint?: unknown } } }
    | undefined
  const pin = settings?.basalt?.pins?.oxlint
  if (typeof pin !== 'string') {
    return {
      findings: [],
      skipped: [`${OXLINT_PRESET} records no oxlint pin, so the pin check cannot run`],
    }
  }
  const results: WeakenedResult[] = await checkWeakenedConfig({
    dir: ctx.root,
    roots,
    oxlintPin: pin,
    baseRef: ctx.options.baseRef === undefined ? defaultBaseRef(ctx.root) : ctx.options.baseRef,
    ...(ctx.options.runLint === undefined ? {} : { runLint: ctx.options.runLint }),
    ...(ctx.options.installedOxlint === undefined
      ? {}
      : { installedOxlint: ctx.options.installedOxlint }),
  })
  const line = (r: WeakenedResult): string => `weakened-config ${r.check} ${r.name}: ${r.detail}`
  return {
    findings: results.filter((r) => r.status === 'failed').map(line),
    skipped: results.filter((r) => r.status === 'skipped').map(line),
  }
}

const check11 = (name: string): Check => ({
  id: 11,
  name,
  run: async (ctx): Promise<Outcome> => {
    const manifest = need(ctx)
    const budget = readBudget(ctx.root)
    if ('error' in budget) return fail(budget.error)
    const sources = rootFiles(ctx, manifest, /\.[cm]?[jt]sx?$/)
    const text = sources.map((f) => readText(ctx.root, f) ?? '').join('\n')
    const findings = [
      ...countBreaches(budget.budget, {
        waivers: (text.match(WAIVER) ?? []).length,
        escapes: (text.match(ESCAPE) ?? []).length,
      }).map((b) => `${b.count} ${b.name} is above the ceiling ${b.ceiling} in ${BUDGET_PATH}`),
      ...ejectFindings(ctx, budget.budget),
      ...designFindings(ctx),
    ]
    const weak = await weakened(ctx)
    findings.push(...weak.findings)
    if (findings.length > 0) return fail([...findings, ...weak.skipped].join('; '))
    // A check that cannot run is not a pass: the whole check is SKIPPED, and SKIPPED fails.
    if (weak.skipped.length > 0) return { status: 'skipped', detail: weak.skipped.join('; ') }
    return pass('budgets hold, ejects are intact, no guard is weakened, DESIGN.md is within bounds')
  },
})

export const guardChecks: Check[] = [check10('tokens-css'), check11('budgets')]
