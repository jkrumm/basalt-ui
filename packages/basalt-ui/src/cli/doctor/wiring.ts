/**
 * Checks 4-7: what `init` and `sync` place. The preset files, the lint that scans something and is
 * invoked by something, the AGENTS block, and the agent skills and rules at the install root.
 */
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import { a11yComponents } from '../../lint/preset'
import { PRESET_FILE } from '../../lint/weakened'
import { renderStylelintConfig } from '../../lint/stylelint/render'
import { SLOTS } from '../../ui/slots'
import { readFrameworkVersion } from '../index'
import { scanBlock } from '../sync/block'
import { AGENTS_FILE, differences, planSync } from '../sync/engine'
import { renderBlock, renderManaged } from '../sync/render'
import type { Unit } from '../sync/render'
import {
  lintRoots,
  readJson,
  readText,
  rootFiles,
  Skip,
  need,
  fail,
  pass,
  verdictOf,
} from './types'
import type { Check } from './types'

export const OXLINT_PRESET = PRESET_FILE
export const STYLELINT_PRESET = '.stylelintrc.basalt.json'

const check4 = (name: string): Check => ({
  id: 4,
  name,
  run: (ctx) => {
    const manifest = need(ctx)
    const block = renderBlock(ctx.pkgRoot, manifest, readFrameworkVersion(ctx.pkgRoot))
    if (block === null) throw new Skip(`${ctx.pkgRoot} ships no AGENTS block template`)
    const preset: Unit = {
      path: STYLELINT_PRESET,
      content: renderStylelintConfig({ ignoreFiles: manifest.tokens.map((t) => t.out) }),
      generated: true,
    }
    const plan = planSync(
      ctx.root,
      manifest,
      [...renderManaged(ctx.pkgRoot, manifest), preset],
      block,
    )
    if ('error' in plan.block) return fail(plan.block.error)
    const findings = differences(plan).map(
      (line) => `${line} (\`basalt-ui init\` places it, \`sync\` refreshes it)`,
    )

    if (lintRoots(manifest).length > 0) {
      const oxlint = readJson(ctx.root, OXLINT_PRESET)
      if (oxlint === null) {
        findings.push(
          `${OXLINT_PRESET}: missing or not JSON (\`basalt-ui init\` places it, \`sync\` refreshes it)`,
        )
      } else {
        const plugins = oxlint['jsPlugins']
        if (!Array.isArray(plugins) || !plugins.includes('basalt-ui/lint')) {
          findings.push(`${OXLINT_PRESET}: jsPlugins does not load basalt-ui/lint`)
        }
        const settings = oxlint['settings'] as Record<string, Record<string, unknown>> | undefined
        const map = settings?.['jsx-a11y']?.['components']
        const mapped = new Set(typeof map === 'object' && map !== null ? Object.keys(map) : [])
        const missing = Object.keys(a11yComponents(SLOTS)).filter((part) => !mapped.has(part))
        if (missing.length > 0) {
          findings.push(
            `${OXLINT_PRESET}: settings.jsx-a11y.components misses ${missing.length} ui/* ` +
              `export(s) (${missing.slice(0, 5).join(', ')}${missing.length > 5 ? ', ...' : ''}); ` +
              'run `basalt-ui sync`',
          )
        }
      }
    }
    return verdictOf(findings, 'managed files, stylelint and oxlint presets are current')
  },
})

/** Where something may invoke `basalt-ui lint`: hooks, scripts, make and CI. */
const INVOKERS = [
  'lefthook.yml',
  'lefthook.yaml',
  '.lefthook.yml',
  'package.json',
  'Makefile',
  '.gitlab-ci.yml',
  '.github/workflows/ci.yml',
  '.github/workflows/ci.yaml',
  '.github/workflows/check.yml',
]
const LINT_INVOCATION = /basalt-ui\s+lint\b/

const check5 = (name: string): Check => ({
  id: 5,
  name,
  run: (ctx) => {
    const manifest = need(ctx)
    const findings: string[] = []
    if (lintRoots(manifest).length > 0) {
      const scripts = rootFiles(ctx, manifest, /\.[cm]?[jt]sx?$/).filter(
        (f) => !f.endsWith('.d.ts'),
      )
      if (scripts.length === 0)
        findings.push('lint scans 0 files: no script file under a declared root')
    }
    if (rootFiles(ctx, manifest, /\.(?:css|astro)$/).length === 0) {
      findings.push('stylelint scans 0 css or astro files under the declared roots')
    }
    if (!INVOKERS.some((f) => LINT_INVOCATION.test(readText(ctx.root, f) ?? ''))) {
      findings.push(
        'nothing invokes `basalt-ui lint` (add it to lefthook, a package script or make check)',
      )
    }
    return verdictOf(findings, 'lint scans the declared roots and something invokes it')
  },
})

/** CLAUDE.md in `dir` or above, up to the git root (or the install root when there is none). */
function claudeMdAbove(root: string): string[] {
  const found: string[] = []
  let stop = root
  for (let at = root; ; at = dirname(at)) {
    if (existsSync(resolve(at, '.git'))) {
      stop = at
      break
    }
    if (dirname(at) === at) break
  }
  for (let at = root; ; at = dirname(at)) {
    if (existsSync(resolve(at, 'CLAUDE.md'))) found.push(resolve(at, 'CLAUDE.md'))
    if (at === stop || dirname(at) === at) break
  }
  return found
}

const check6 = (name: string): Check => ({
  id: 6,
  name,
  run: (ctx) => {
    need(ctx)
    const findings: string[] = []
    const agents = readText(ctx.root, AGENTS_FILE)
    if (agents === null) findings.push(`${AGENTS_FILE} is missing: run \`basalt-ui sync\``)
    else {
      const scan = scanBlock(agents, AGENTS_FILE)
      if (scan === 'absent')
        findings.push(`${AGENTS_FILE} has no basalt block: run \`basalt-ui sync\``)
      else if ('error' in scan) findings.push(scan.error)
    }
    for (const file of claudeMdAbove(ctx.root)) {
      findings.push(
        `${file} exists and shadows ${AGENTS_FILE}; move its content into ${AGENTS_FILE}`,
      )
    }
    return verdictOf(findings, `${AGENTS_FILE} carries the block; no CLAUDE.md in or above`)
  },
})

/** The skills an agent enters through; the block names them, the rest load from their own header. */
const ENTRY_SKILLS = ['basalt-design', 'basalt-app']

const check7 = (name: string): Check => ({
  id: 7,
  name,
  run: (ctx) => {
    const manifest = need(ctx)
    const units = renderManaged(ctx.pkgRoot, manifest)
    if (units.length === 0) return pass('no agent layer for profile tokens')
    const findings = units
      .filter((u) => !existsSync(resolve(ctx.root, u.path)))
      .map((u) => `${u.path} is missing at the install root: run \`basalt-ui sync\``)
    const agents = readText(ctx.root, AGENTS_FILE) ?? ''
    const scan = scanBlock(agents, AGENTS_FILE)
    const block =
      typeof scan === 'object' && 'start' in scan ? agents.slice(scan.start, scan.end) : ''
    const placed = new Set(
      units.flatMap((u) => /^\.claude\/skills\/([^/]+)\//.exec(u.path)?.[1] ?? []),
    )
    for (const skill of ENTRY_SKILLS.filter((s) => placed.has(s))) {
      if (!block.includes(skill)) findings.push(`the AGENTS block does not name the ${skill} skill`)
    }
    return verdictOf(findings, `${units.length} skills, rules and agents placed and named`)
  },
})

export const wiringChecks: Check[] = [
  check4('preset'),
  check5('lint-scan'),
  check6('agents-block'),
  check7('skills-rules'),
]
