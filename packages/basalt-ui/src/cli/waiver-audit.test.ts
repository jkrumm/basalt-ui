/**
 * `check-theme --audit-allows` — the accountability half of the escape hatch.
 *
 * 1.20.0 shipped `theme-allow-unscoped`, which reports a waiver that names no rule. It cannot see
 * the other failure: a perfectly well-written waiver whose finding no longer exists. Two consumers
 * found five of those by hand — editing the token out and re-running the guard — and that manual
 * method is what this command automates, which is why every assertion below is about a VERDICT
 * derived from re-running the scan, never from parsing the annotation's text.
 *
 * Run: bun test packages/basalt-ui/src/cli/waiver-audit.test.ts
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { checkTheme } from './index.ts'

const PKG_ROOT = fileURLToPath(new URL('../../', import.meta.url))

let dir: string

function write(relPath: string, content: string): void {
  const abs = join(dir, relPath)
  mkdirSync(resolve(abs, '..'), { recursive: true })
  writeFileSync(abs, content, 'utf8')
}

function audit(): { code: number; log: string } {
  const originalLog = console.log
  const originalError = console.error
  let log = ''
  const sink = (...args: unknown[]) => {
    log += `${args.join(' ')}\n`
  }
  console.log = sink
  console.error = sink
  try {
    return { code: checkTheme(dir, ['--audit-allows']), log }
  } finally {
    console.log = originalLog
    console.error = originalError
  }
}

/** A repo whose only source file is the one under test. */
function fixture(source: string, basalt: Record<string, unknown> = {}): void {
  write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'], ...basalt } }))
  write('src/app.tsx', source)
}

beforeEach(() => {
  dir = mkdtempSync(resolve(tmpdir(), 'basalt-audit-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('check-theme --audit-allows — theme-allow annotations', () => {
  it('names what a live waiver still suppresses, and exits 0', () => {
    fixture("export const c = '#ff0000' // theme-allow raw-hex — a deliberate brand literal\n")
    const { code, log } = audit()
    expect(log).toContain('suppresses raw-hex@1')
    expect(code).toBe(0)
  })

  it('calls a waiver over a line with no finding DEAD, and exits 1', () => {
    fixture('export const c = 1 // theme-allow raw-hex — nothing here fires any more\n')
    const { code, log } = audit()
    expect(log).toContain('SUPPRESSES NOTHING')
    expect(code).toBe(1)
  })

  it('does not report prose that merely mentions the token', () => {
    // The guard stopped treating a mid-comment mention as an annotation for exactly this reason;
    // an audit that listed them as dead waivers would send someone editing documentation.
    fixture('// Waive it with a `theme-allow raw-hex — why` comment.\nexport const c = 1\n')
    const { code, log } = audit()
    expect(log).toContain('annotations (0)')
    expect(code).toBe(0)
  })

  it('says oxlint could not be run rather than calling a plugin-rule waiver dead', () => {
    // `hand-rolled-plot` lives in the plugin, so `checkSource` can never see what it suppresses.
    // With no oxlint reachable from the fixture the honest answer is "cannot judge" — reporting
    // "delete it" here would be the command telling someone to remove a live waiver.
    fixture(
      '// theme-allow hand-rolled-plot — DualPanel is not a single cartesian plot\nexport const c = 1\n',
    )
    const { code, log } = audit()
    expect(log).toContain('oxlint could not be run here')
    expect(log).not.toContain('SUPPRESSES NOTHING')
    expect(code).toBe(0)
  })

  it('names the scope it audited, so "0 dead" is never read as "0 dead anywhere"', () => {
    // The audit reads exactly what check-theme reads, and that is WIDER than `basalt.roots` — two
    // consumers reported a live `public/site.webmanifest` waiver under a scope line claiming
    // files outside roots are not audited. The line has to name every class the scan reaches, or
    // it is a second false statement in the sentence that exists to prevent one.
    fixture("export const c = '#ff0000' // theme-allow raw-hex — brand literal\n")
    const { log } = audit()
    expect(log).toContain('Scope: the 1 file(s) check-theme scans — everything under basalt.roots')
    expect(log).toContain('sibling index.html and public/ tree')
    expect(log).toContain('basalt.include')
  })

  it('marks an unaccountable waiver while still reporting what it covers', () => {
    fixture("export const c = '#ff0000' // theme-allow\n")
    const { log } = audit()
    expect(log).toContain('suppresses raw-hex@1')
    expect(log).toContain('no rule id')
    expect(log).toContain('1 unaccountable')
  })
})

describe('check-theme --audit-allows — basalt.exemptRules', () => {
  it('prints the reason from the object form, and says so when there is none', () => {
    fixture("export const c = '#ff0000'\n", {
      exemptRules: { 'raw-hex': { paths: ['src'], reason: 'a vendor asset basalt does not own' } },
    })
    const { log } = audit()
    expect(log).toContain('a vendor asset basalt does not own')
    expect(log).toContain('suppresses findings in src/app.tsx')

    fixture("export const c = '#ff0000'\n", { exemptRules: { 'raw-hex': ['src'] } })
    expect(audit().log).toContain('[no reason recorded]')
  })

  it('the object form really does exempt — the reason is accountability, not a second config', () => {
    fixture("export const c = '#ff0000'\n", {
      exemptRules: { 'raw-hex': { paths: ['src'], reason: 'a vendor asset basalt does not own' } },
    })
    expect(checkTheme(dir, [])).toBe(0)
  })

  it('reports a pattern that matches no scanned file as dead, and exits 1', () => {
    // rollhook wrote a real, correct relative path, it matched nothing, and nothing said so — the
    // finding kept failing the build with the config sitting right there looking like the answer.
    fixture("export const c = '#ff0000'\n", { exemptRules: { 'raw-hex': ['does-not-exist'] } })
    const { code, log } = audit()
    expect(log).toContain('matches no scanned file')
    expect(code).toBe(1)
  })
})

// ── the oxlint half ───────────────────────────────────────────────────────────────────────────
//
// The `error`-severity design rules live in the oxlint plugin, not in `checkSource`. Until this,
// the audit declined to judge them — 8 of 8 annotations in argo, 11 of 14 in linewatch — so the
// exit-1 gate covered an empty set. These prove the method generalizes: neutralize the annotation,
// re-run oxlint over that one file, and the findings that appear are what it covers.

const REPO_ROOT = resolve(PKG_ROOT, '../..')
const OXLINT_BIN = resolve(REPO_ROOT, 'node_modules/.bin/oxlint')

/** Make oxlint reachable from the fixture and point it at the shipped preset (plugin included). */
function withOxlint(): void {
  mkdirSync(join(dir, 'node_modules/.bin'), { recursive: true })
  symlinkSync(OXLINT_BIN, join(dir, 'node_modules/.bin/oxlint'))
  write('.oxlintrc.json', JSON.stringify({ extends: [resolve(PKG_ROOT, 'configs/oxlint.json')] }))
}

describe.skipIf(!existsSync(OXLINT_BIN))('check-theme --audit-allows — oxlint plugin rules', () => {
  it('proves a plugin-rule waiver LIVE, naming the rule and the line it covers', () => {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write(
      'src/charts/plot.tsx',
      "import { AxisLeftNumeric } from 'basalt-ui/charts'\n\n" +
        '// theme-allow hand-rolled-plot — this pane is not a single cartesian plot\n' +
        'export const Plot = () => <AxisLeftNumeric />\n',
    )
    withOxlint()
    const { code, log } = audit()
    expect(log).toContain('suppresses hand-rolled-plot@4 (oxlint)')
    expect(code).toBe(0)
  })

  it('calls a plugin-rule waiver over nothing DEAD, and exits 1 — the gate now covers them', () => {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write(
      'src/charts/plot.tsx',
      '// theme-allow hand-rolled-plot — this pane is not a single cartesian plot\n' +
        'export const Plot = () => null\n',
    )
    withOxlint()
    const { code, log } = audit()
    expect(log).toContain('SUPPRESSES NOTHING')
    expect(log).toContain('re-running oxlint')
    expect(code).toBe(1)
  })

  it('leaves no probe file behind — the neutralized copy is a temp file basalt owns', () => {
    write('package.json', JSON.stringify({ name: 'fixture', basalt: { roots: ['src'] } }))
    write(
      'src/charts/plot.tsx',
      "import { AxisLeftNumeric } from 'basalt-ui/charts'\n\n" +
        '// theme-allow hand-rolled-plot — this pane is not a single cartesian plot\n' +
        'export const Plot = () => <AxisLeftNumeric />\n',
    )
    withOxlint()
    audit()
    expect(readdirSync(join(dir, 'src/charts'))).toEqual(['plot.tsx'])
  })
})
