/**
 * Checks 10-11: the committed token sheets and the guard budgets. Check 10 renders each recorded
 * flag set the way `sync` does and compares the bytes; check 11 counts ejects, waivers and escapes against
 * `.basalt/budget.json`, verifies the ejected files, runs the weakened-config check from the
 * guardrail concept and reads DESIGN.md.
 */
import { checkWeakenedConfig, defaultBaseRef } from '../../lint/weakened'
import type { WeakenedResult } from '../../lint/weakened'
import { BUDGET_PATH, countBreaches, countedFigure, raiseCommand, readBudget } from '../budget'
import { rootFiles as lintFiles } from '../lint/engine'
import { countSource } from '../lint/stats'
import { readFrameworkVersion } from '../index'
import { MANIFEST_PATH } from '../manifest'
import { renderTokens } from '../tokens-css'
import { ejectFindings } from './eject'
import { OXLINT_PRESET } from './wiring'
import { fail, lintRoots, need, pass, readJson, readText, rootsOf, verdictOf } from './types'
import type { Check, Ctx, Outcome } from './types'

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
    // The renderer `sync` writes the sheets from, so a drift this reports is one `sync` fixes.
    const version = readFrameworkVersion(ctx.pkgRoot)
    const findings = manifest.tokens.flatMap((entry) => {
      const emitted = renderTokens([...entry.flags, '--out', entry.out], ctx.root, version)
      if ('error' in emitted)
        return [`${entry.out}: ${emitted.error}; fix its flags in ${MANIFEST_PATH}`]
      const files = 'files' in emitted ? emitted.files : []
      return files
        .filter(({ out, content }) => readText(ctx.root, out) !== content)
        .map(({ out }) => `${out} is missing or out of date: run \`basalt-ui sync\``)
    })
    return verdictOf(findings, `${manifest.tokens.length} token output(s) match their flags`)
  },
})

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
    // The one counter `lint --stats` uses, over the files a full `lint` scans.
    const project = { root: ctx.root, manifest, roots: rootsOf(manifest) }
    const counted = countSource(project, lintFiles(project))
    const recorded = budget.budget.waivers
    const findings = [
      ...(counted.waivers > recorded
        ? [
            `${countedFigure('waivers', counted.waivers)} counted, ${BUDGET_PATH} records ${recorded}: run \`basalt-ui lint\` to record the count and commit the file`,
          ]
        : []),
      ...countBreaches(budget.budget, { escapes: counted.escapes }).map(
        (b) =>
          `${countedFigure(b.name, b.count)} above the ceiling ${b.ceiling} in ${BUDGET_PATH}: ${raiseCommand(b.name)}`,
      ),
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
