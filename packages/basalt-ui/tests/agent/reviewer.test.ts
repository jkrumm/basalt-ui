/**
 * sk-9: the shipped reviewer pair. `agent/reviewer/rubric.md` is the tool-neutral rubric (items,
 * fail-closed rules, viewport applicability, severity, diff mode, output); the wrapper is the thin
 * subagent that points at it.
 *
 * The reviewer is a model, not a script (the CLI stays model-free), so these tests pin the
 * CONTRACT it scores by: the rubric text says each rule, and a small reference reading of the
 * rule over fixture out dirs shows the rule is decidable from `metrics.json` and two `last.json`
 * files. The detector half runs the real `detectFindings`.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { detectFindings, scoreOf } from '../../src/cli/shot/detect'
import type { Finding, Severity } from '../../src/cli/shot/detect'
import type { ShotMetrics } from '../../src/cli/shot/types'

const REVIEWER = resolve(import.meta.dir, '../../agent/reviewer')
const rubric = readFileSync(join(REVIEWER, 'rubric.md'), 'utf8')
const wrapper = readFileSync(join(REVIEWER, 'basalt-design-reviewer.md'), 'utf8')
const detectSource = readFileSync(resolve(import.meta.dir, '../../src/cli/shot/detect.ts'), 'utf8')

/** The numbered items under a `### <axis>` heading, up to the next heading. */
function items(text: string, axis: string): number[] {
  const section = text.split(`### ${axis}\n`)[1]?.split(/\n#{2,3} /)[0] ?? ''
  return [...section.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]))
}

const KNOWN: Record<string, number[]> = {
  Craft: items(rubric, 'Craft'),
  Expression: items(rubric, 'Expression'),
  Communication: items(rubric, 'Communication'),
}

describe('reviewer rubric', () => {
  it('lists every rubric item in order', () => {
    expect(KNOWN['Craft']).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(KNOWN['Expression']).toEqual([1, 2, 3, 4, 5])
    expect(KNOWN['Communication']).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('cites only rubric items that exist, in the rubric and in the wrapper', () => {
    for (const text of [rubric, wrapper]) {
      const cited = [...text.matchAll(/\b(Craft|Expression|Communication) (\d+)\b/g)]
      expect(cited.length).toBeGreaterThan(0)
      for (const [, axis, n] of cited) expect(KNOWN[axis!]).toContain(Number(n))
    }
  })

  it('is tool-neutral: no tool names in the rubric', () => {
    expect(rubric).not.toContain('Agent tool')
    expect(rubric).not.toMatch(/\bTask\b/)
  })

  it('every craft-N rule the shot detector emits is a Craft item of the rubric', () => {
    const emitted = new Set(
      [...detectSource.matchAll(/rule: [`']craft-(\d+)\//g)].map((m) => Number(m[1])),
    )
    expect(emitted.size).toBeGreaterThan(0)
    for (const n of emitted) expect(KNOWN['Craft']).toContain(n)
    // `lint/*` maps to Craft 4 by default, which must exist; the mapping is written down.
    expect(rubric).toContain('`craft-N/*` → Craft N')
    expect(rubric).toContain('Craft 4 by default')
  })

  it('tags the measured, mobile and page items', () => {
    const craft = rubric.split('### Craft\n')[1]?.split('### Expression')[0] ?? ''
    for (const n of [1, 2, 3, 6, 7])
      expect(craft).toMatch(new RegExp(`^${n}\\. [^\\n]*\\*\\*\\[measured\\]\\*\\*`, 'm'))
    expect(craft).not.toMatch(/^5\. [^\n]*\*\*\[measured\]\*\*/m)
    expect(craft).toContain('axe owns them')
    expect(craft).toMatch(/\*\*\[mobile\]\*\*/)
    expect(rubric).toContain('**[page]**')
  })

  it('makes the sheets and the Read line mandatory', () => {
    expect(rubric).toContain("Read every anchor's `sheet` and every `_page` shot")
    expect(rubric).toContain('`scaleError` set')
    expect(rubric).toContain('Read: <sheet file>')
  })

  it('carries the banned-filler list', () => {
    for (const phrase of [
      '"Here you can see…"',
      '"at a glance"',
      '"Overview"',
      '"N/A"',
      'emoji in chrome',
    ]) {
      expect(rubric).toContain(phrase)
    }
  })

  it('states one bar, severities, the score and the output order', () => {
    expect(rubric).toContain('P0 and P1 fail the component; P2 and P3 are noted')
    expect(rubric.match(/P0 and P1 fail/g)).toHaveLength(1)
    for (const sev of ['P0', 'P1', 'P2', 'P3']) expect(rubric).toContain(`**${sev}**`)
    const order = ['content', 'layout', 'style'].map((w) => rubric.indexOf(`**${w}**`))
    expect(order.every((i) => i >= 0)).toBe(true)
    expect(order.toSorted((a, b) => a - b)).toEqual(order)
    expect(rubric).toContain('Score: <0-100>')
    expect(rubric).toContain('never a gate')
  })

  it('does not contradict the v3 doctrine: tinted delta badge, ink-inverted primary', () => {
    expect(rubric).toContain('tinted delta badge')
    expect(rubric).toContain('the primary action is ink-inverted')
    expect(rubric).not.toContain('text in its trend colour')
    expect(rubric).not.toContain('references/catalogue.md')
    expect(rubric).not.toContain('references/states.md')
  })

  it('the DEGRADED banner can never close a round', () => {
    expect(rubric).toContain('DEGRADED: inline review by the builder')
    expect(rubric).toContain('never closes a round')
    expect(rubric).toContain('score is 0')
  })
})

describe('reviewer wrapper', () => {
  it('has frontmatter whose name is the file stem and no spawn tool', () => {
    const front = wrapper.split('---')[1] ?? ''
    expect(front).toContain('name: basalt-design-reviewer')
    expect(front).toMatch(/tools: Read, Grep, Glob, Write\n/)
    expect(front).not.toContain('Agent')
    expect(front).toContain('model: inherit')
  })

  it('stays within 40 lines and points at the rubric', () => {
    expect(wrapper.trimEnd().split('\n').length).toBeLessThanOrEqual(40)
    expect(wrapper).toContain('agent/reviewer/rubric.md')
  })

  it('keeps the honesty, fail-closed and Read-line obligations', () => {
    expect(wrapper).toContain('DEGRADED: inline review by the builder')
    expect(wrapper).toContain("Read every anchor's `sheet` and every `_page` shot")
    expect(wrapper).toContain('`scaleError` set')
    expect(wrapper).toContain('Read: <sheet file>')
    expect(wrapper).toContain('metrics.json unreadable')
    expect(wrapper).toContain('`unverified` counts as fail')
  })

  it('writes last.json into the out dir named by .basalt/last-shot.json', () => {
    expect(wrapper).toContain('.basalt/last-shot.json')
    expect(wrapper).toContain('`last.json` in the shot out dir')
    expect(rubric).toContain('`last.json` in the shot out dir')
  })
})

// ── Reference readings of the rubric's rules over fixture out dirs ────────────────────────────────

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const SIDES = { top: 8, right: 8, bottom: 8, left: 8 }
function metrics(over: Partial<ShotMetrics> = {}): ShotMetrics {
  return {
    version: 1,
    generatedAt: '2026-11-13T00:00:00.000Z',
    base: 'http://x',
    routes: ['/'],
    viewports: ['desktop', 'mobile'],
    schemes: ['light'],
    states: ['rest'],
    scale: [
      {
        scheme: 'light',
        viewport: 'desktop',
        spacing: { xs: 4, sm: 8, md: 12 },
        radius: { sm: 4, md: 8 },
        fontSizes: { xs: 12, sm: 14 },
      },
    ],
    anchors: [
      {
        route: '/',
        name: 'card',
        scheme: 'light',
        viewport: 'desktop',
        box: { width: 300, height: 120 },
        padding: SIDES,
        gap: { row: 8, column: 8 },
        radius: 8,
        borderWidth: 0,
        fontSizes: [12, 14],
        nested: [],
        emptyRatio: 0.1,
        sheet: 'png/card__sheet.png',
      },
    ],
    shots: [],
    ...over,
  } as ShotMetrics
}

/** An out dir holding the given `metrics.json` text (absent when null) and optional files. */
function outDir(metricsText: string | null, files: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), 'reviewer-'))
  dirs.push(dir)
  if (metricsText !== null) writeFileSync(join(dir, 'metrics.json'), metricsText)
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

type Preflight = { failClosed: string | null; unverified: string[] }

/** The rubric's "Fail closed" section, read over an out dir. */
function preflight(dir: string): Preflight {
  let m: ShotMetrics
  try {
    m = JSON.parse(readFileSync(join(dir, 'metrics.json'), 'utf8')) as ShotMetrics
  } catch {
    return { failClosed: 'metrics.json unreadable', unverified: [] }
  }
  if (m.anchors.length === 0) return { failClosed: 'no anchors', unverified: [] }
  const unverified: string[] = []
  if (m.scaleError !== undefined || !m.scale || m.scale.length === 0) unverified.push('Craft 1')
  return { failClosed: null, unverified }
}

/** The rubric's "Viewports" section: which clauses apply, given the manifest and the run. */
function mobileApplies(manifestViewports: string[], m: ShotMetrics): boolean {
  const declared = manifestViewports.length > 0 ? manifestViewports : m.viewports
  return declared.includes('mobile')
}

describe('reviewer fails closed', () => {
  it('a missing metrics.json fails the whole run', () => {
    expect(preflight(outDir(null))).toEqual({
      failClosed: 'metrics.json unreadable',
      unverified: [],
    })
    expect(preflight(outDir('{ not json')).failClosed).toBe('metrics.json unreadable')
    expect(rubric).toContain('"metrics.json unreadable"')
  })

  it('zero anchors fails the whole run, and the detector reports nothing measured', () => {
    const empty = metrics({ anchors: [] })
    expect(preflight(outDir(JSON.stringify(empty))).failClosed).toBe('no anchors')
    expect(rubric).toContain('"no anchors"')
    // `detect` agrees: it reports no score for an out dir with no anchor.
    expect(detectFindings(empty).every((f) => f.rule !== 'craft-1/off-scale-inset')).toBe(true)
  })

  it('an absent scale leaves Craft 1 unverified, and the detector flags it P1', () => {
    const noScale = metrics({ scale: [] })
    expect(preflight(outDir(JSON.stringify(noScale)))).toEqual({
      failClosed: null,
      unverified: ['Craft 1'],
    })
    const withError = metrics({ scaleError: 'no theme custom properties' })
    expect(preflight(outDir(JSON.stringify(withError))).unverified).toEqual(['Craft 1'])
    const found = detectFindings(noScale).find((f) => f.rule === 'craft-1/scale-error')
    expect(found?.severity).toBe('P1')
    expect(rubric).toContain('Craft 1 is `unverified` for every component')
  })

  it('a healthy out dir fails nothing closed', () => {
    expect(preflight(outDir(JSON.stringify(metrics())))).toEqual({
      failClosed: null,
      unverified: [],
    })
  })
})

describe('mobile items are keyed on the declared viewports', () => {
  it('a desktop-only manifest yields n/a for the mobile items, not failures', () => {
    const desktopOnly = metrics({ viewports: ['desktop'] })
    expect(mobileApplies(['desktop'], desktopOnly)).toBe(false)
    expect(mobileApplies([], desktopOnly)).toBe(false)
    // the manifest wins over the run; with neither declaring mobile the clause is n/a
    expect(mobileApplies(['desktop'], metrics())).toBe(false)
    expect(mobileApplies(['desktop', 'mobile'], desktopOnly)).toBe(true)
    expect(mobileApplies([], metrics())).toBe(true)
    // and the rubric says n/a, never failed or unverified
    expect(rubric).toContain(
      'every `[mobile]` clause is `n/a`: not scored, not failed, not `unverified`',
    )
    // the detector emits nothing for a mobile viewport that was never shot
    expect(
      detectFindings(desktopOnly).filter((f) => f.where.some((w) => w.endsWith('/mobile'))),
    ).toEqual([])
  })
})

// ── Diff mode ─────────────────────────────────────────────────────────────────────────────────────

type RoundFinding = {
  anchor: string
  axis: string
  item: number
  severity: Severity
  defect: string
}
type Labelled = RoundFinding & { status: 'new' | 'carried' | 'fixed' }
type Verdict = {
  findings: Labelled[]
  counts: Record<Severity, number>
  regression: boolean
  score: number
}

const keyOf = (f: RoundFinding): string => `${f.anchor}|${f.axis} ${f.item}`
const WEIGHT: Record<Severity, number> = { P0: 25, P1: 10, P2: 3, P3: 1 }

/** The rubric's "Diff mode" section: label, count the live findings, decide `regression`. */
function diffRounds(previous: RoundFinding[] | null, current: RoundFinding[]): Verdict {
  const before = new Set((previous ?? []).map(keyOf))
  const now = new Set(current.map(keyOf))
  const findings: Labelled[] = [
    ...current.map((f) => ({
      ...f,
      status: before.has(keyOf(f)) ? ('carried' as const) : ('new' as const),
    })),
    ...(previous ?? [])
      .filter((f) => !now.has(keyOf(f)))
      .map((f) => ({ ...f, status: 'fixed' as const })),
  ]
  const live = findings.filter((f) => f.status !== 'fixed')
  const counts: Record<Severity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  for (const f of live) counts[f.severity] += 1
  const score = Math.max(0, 100 - live.reduce((sum, f) => sum + WEIGHT[f.severity], 0))
  return { findings, counts, regression: live.some((f) => f.severity === 'P1'), score }
}

const p1 = (anchor: string, item = 1): RoundFinding => ({
  anchor,
  axis: 'Craft',
  item,
  severity: 'P1',
  defect: `${anchor} fails Craft ${item}`,
})
const p2 = (anchor: string): RoundFinding => ({ ...p1(anchor, 4), severity: 'P2' })

const asFinding = (f: RoundFinding): Finding => ({
  rule: `craft-${f.item}/x`,
  severity: f.severity,
  layer: 'layout',
  anchor: f.anchor,
  where: [],
  cite: 'metrics.json',
  defect: f.defect,
})

describe('diff mode', () => {
  const round1 = [p1('card', 1), p1('table', 3), p2('chart')]
  const round2 = [p1('card', 1), p1('list', 6), p2('chart')]
  const verdict = diffRounds(round1, round2)
  const status = (anchor: string): string | undefined =>
    verdict.findings.find((f) => f.anchor === anchor)?.status

  it('labels findings new, carried and fixed', () => {
    expect(status('card')).toBe('carried')
    expect(status('list')).toBe('new')
    expect(status('table')).toBe('fixed')
    expect(status('chart')).toBe('carried')
  })

  it('counts only the live findings, and a fixed one is not counted', () => {
    expect(verdict.counts).toEqual({ P0: 0, P1: 2, P2: 1, P3: 0 })
    expect(verdict.score).toBe(100 - 20 - 3)
  })

  it('prints regression: yes when a P1 is new or carried', () => {
    expect(verdict.regression).toBe(true)
    expect(diffRounds([p1('card')], [p1('card')]).regression).toBe(true) // carried
    expect(diffRounds([], [p1('card')]).regression).toBe(true) // new
  })

  it('prints regression: no when no P1 is new or carried', () => {
    const clean = diffRounds([p1('card'), p1('table')], [p2('chart')])
    expect(clean.regression).toBe(false)
    expect(clean.findings.filter((f) => f.status === 'fixed')).toHaveLength(2)
    expect(diffRounds([p1('card')], []).regression).toBe(false)
  })

  it('without a previous last.json every finding is new', () => {
    const first = diffRounds(null, round1)
    expect(first.findings.every((f) => f.status === 'new')).toBe(true)
  })

  it('the score matches the number `shot detect` computes, and is never the verdict', () => {
    expect(verdict.score).toBe(scoreOf(round2.map(asFinding)))
    // a lower score with fewer P1 is not a regression: the verdict is the counts
    const moreP2 = diffRounds(
      [p1('card')],
      Array.from({ length: 12 }, (_, i) => p2(`a${i}`)),
    )
    expect(moreP2.score).toBeLessThan(90)
    expect(moreP2.regression).toBe(false)
    for (const phrase of [
      'regression: yes',
      'regression: no',
      'never a gate',
      '`new`',
      '`carried`',
      '`fixed`',
    ]) {
      expect(rubric).toContain(phrase)
    }
  })
})
