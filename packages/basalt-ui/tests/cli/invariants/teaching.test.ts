/**
 * Teaching-loop invariants 31-35, 39, 40 (docs/v3/concepts/skills-agent-layer.md section 6): the
 * `shot` round and the reviewer that scores it. None of these needs a browser; they read the shot
 * argument parser, `detectFindings` and the shipped reviewer files as the v3 tree lays them out
 * (`agent/reviewer/{rubric,basalt-design-reviewer}.md`).
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { detectFindings } from '../../../src/cli/shot/detect'
import { parseShotArgs, planOut } from '../../../src/cli/shot/index'
import type { ShotMetrics } from '../../../src/cli/shot/types'
import { cleanupRepos, makeRepo, PKG_ROOT } from './support'

afterEach(cleanupRepos)

const reviewerDir = join(PKG_ROOT, 'agent/reviewer')
const rubricFile = join(reviewerDir, 'rubric.md')
const wrapperFile = join(reviewerDir, 'basalt-design-reviewer.md')
const read = (file: string): string => readFileSync(file, 'utf8')

/** The numbered items under a `### <axis>` heading, up to the next heading. */
function items(text: string, axis: string): number[] {
  const section = text.split(`### ${axis}\n`)[1]?.split(/\n#{2,3} /)[0] ?? ''
  return [...section.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]))
}

const SIDES = { top: 8, right: 8, bottom: 8, left: 8 }
function metrics(over: Partial<ShotMetrics> = {}): ShotMetrics {
  return {
    version: 1,
    generatedAt: '2026-11-10T00:00:00.000Z',
    base: 'http://x',
    routes: ['/'],
    viewports: ['desktop'],
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
        padding: { ...SIDES, left: 20 },
        gap: { row: 8, column: 8 },
        radius: 8,
        borderWidth: 0,
        fontSizes: [12, 14],
        nested: [],
        emptyRatio: 0.1,
        contrast: { min: 7, failures: [] },
      },
    ],
    shots: [],
    ...over,
  } as ShotMetrics
}

describe('teaching loop', () => {
  // flips in: v3-sk-10-shot (--out is required and must not exist yet)
  it.failing(
    'inv 31: a round writes to a fresh --out: omitted or already present is refused',
    () => {
      const dir = makeRepo()
      expect(() => parseShotArgs(['/', '--dist', 'dist'], { env: {}, cwd: dir })).toThrow(/--out/)
      mkdirSync(join(dir, 'shots'))
      expect(() => planOut(dir, 'shots')).toThrow(/fresh|exists/)
    },
  )

  // Already held by `detect`; v3-sk-10-shot must keep it when the scale reads the app's steps.
  it("inv 32: the scale includes the app's own steps, so an app step is not off-scale", () => {
    const ids = (m: ShotMetrics): string[] => detectFindings(m).map((f) => f.rule)
    expect(ids(metrics())).toContain('craft-1/off-scale-inset')
    const withAppStep = metrics()
    withAppStep.scale[0]!.spacing = { ...withAppStep.scale[0]!.spacing, app: 20 }
    expect(ids(withAppStep)).not.toContain('craft-1/off-scale-inset')
  })

  // flips in: v3-sk-10-shot (the wrapper moves to agent/reviewer/)
  it.failing('inv 33: the reviewer must read every sheet, and says so with a Read line', () => {
    const text = read(wrapperFile)
    expect(text).toContain("Read every anchor's `sheet` and every `_page` shot")
    expect(text).toContain('`scaleError` set')
    expect(text).toContain('Read: <sheet file>')
  })

  // flips in: v3-sk-9-reviewer (rubric.md is the tool-neutral rubric the wrapper cites)
  it.failing('inv 34: the reviewer cites only rubric items that exist', () => {
    expect(existsSync(rubricFile)).toBe(true)
    const rubric = read(rubricFile)
    const known: Record<string, number[]> = {
      Craft: items(rubric, 'Craft'),
      Expression: items(rubric, 'Expression'),
      Communication: items(rubric, 'Communication'),
    }
    for (const axis of Object.keys(known)) expect(known[axis]!.length).toBeGreaterThan(0)
    const cited = [...read(wrapperFile).matchAll(/\b(Craft|Expression|Communication) (\d+)\b/g)]
    expect(cited.length).toBeGreaterThan(0)
    for (const [, axis, n] of cited) expect(known[axis!]).toContain(Number(n))
  })

  // flips in: v3-sk-10-shot (anchors declare through data-phase or data-shot-states)
  it.failing(
    'inv 35: every state anchor declares (data-phase or data-shot-states) or is excluded by data-shot-absent',
    () => {
      const capture = read(join(PKG_ROOT, 'src/cli/shot/capture.ts'))
      for (const attr of ['data-phase', 'data-shot-states', 'data-shot-absent']) {
        expect(capture).toContain(attr)
      }
      const stateful = metrics({
        shots: [
          {
            route: '/',
            name: 'card',
            scheme: 'light',
            viewport: 'desktop',
            state: 'rest',
            file: 'png/a.png',
            status: 'ok',
            stateful: true,
          },
        ],
      })
      expect(detectFindings(stateful).map((f) => f.rule)).toContain('craft-7/no-declared-states')
    },
  )

  // flips in: v3-sk-9-reviewer (one bar, defined in the rubric)
  it.failing(
    'inv 39: one calibrated bar: P0 and P1 fail, a single bar sentence, no second threshold',
    () => {
      const text = read(rubricFile)
      expect(text).toContain('P0 and P1 fail the component; P2 and P3 are noted')
      expect(text.match(/P0 and P1 fail/g)).toHaveLength(1)
      expect(text).not.toMatch(/pass(es)? (at|above|with) (a )?score (of )?\d+/i)
    },
  )

  // flips in: v3-sk-9-reviewer (the five-defect list moves into the thin skill's references)
  it.failing('inv 40: the pre-round five-defect list names five defects before round 1', () => {
    const skill = read(join(PKG_ROOT, 'agent/skills/basalt-design/SKILL.md'))
    const section = skill.split(/Before round 1/)[1]?.split(/\n\d+\. /)[0] ?? ''
    expect(section).toMatch(/five defects/)
    const antiDefaults = read(
      join(PKG_ROOT, 'agent/skills/basalt-design/references/anti-defaults.md'),
    )
    expect(antiDefaults.match(/^#{2,3} /gm)?.length ?? 0).toBeGreaterThanOrEqual(5)
    expect(existsSync(rubricFile)).toBe(true)
  })
})
