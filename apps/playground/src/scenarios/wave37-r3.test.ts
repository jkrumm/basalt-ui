/**
 * Wave 37 playground round 3: the round-2 defects the playground owns, and the round-2 props it
 * adopts (#401–#408). Each assertion is one a later edit could silently undo.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'bun:test'
import { date, defineFormat } from 'basalt-ui/format'
import { PAGE_FORMAT } from '../demo/page-format'
import { ComponentsSurfaces } from '../demo/ComponentsPage'
import {
  BUDGETS,
  DISPATCH_COMPLETE_DAYS,
  DISPATCH_POINTS,
  FAILURES_BY_HOUR,
  FAILURES_POINTS,
  FLOW_CLOSED,
  FLOW_RANGE_LABEL,
  NEEDS_YOU_POINTS,
  NEEDS_YOU_TREND,
  OLDEST_WAIT_HOURS,
  STUCK,
  fmtAge,
} from './agents-data'
import { fmtEur } from './fixture-utils'
import { AgentsScenario } from './S3Agents'
import { SpendScenario } from './S4Spend'
import { TrainingScenario } from './S2Training'
import {
  DISTRIBUTION,
  DISTRIBUTION_Y_MAX,
  MTD_POINTS,
  MTD_TOTALS,
  PROJECTS_MTD,
  WINDOW_LABEL,
  daysTick,
} from './spend-data'
import {
  DISTANCE_7D_POINTS,
  DISTANCE_7D_TREND,
  GOAL_SESSIONS,
  MONTH_END_LABEL,
  PACE_GAP,
  PACE_SESSIONS,
  SESSIONS_7D_POINTS,
  SESSIONS_7D_TREND,
  TODAY_LABEL,
  VOLUME_7D_POINTS,
  VOLUME_7D_TREND,
} from './training-data'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const anchor = (c: HTMLElement, name: string): HTMLElement => {
  const el = c.querySelector<HTMLElement>(`[data-shot="${name}"]`)
  if (el === null) throw new Error(`no [data-shot="${name}"]`)
  return el
}
const text = (el: Element): string => {
  const copy = el.cloneNode(true) as Element
  for (const hidden of copy.querySelectorAll('.mantine-VisuallyHidden-root')) hidden.remove()
  const out: string[] = []
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) out.push(n.textContent ?? '')
  return out
    .map((w) => w.trim())
    .filter((w) => w !== '')
    .join(' ')
    .replaceAll(String.fromCharCode(160), ' ')
}
const source = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8')
const training = (shotState?: ShotState) => mount(createElement(TrainingScenario, { shotState }))
const agents = (shotState?: ShotState) => mount(createElement(AgentsScenario, { shotState }))
const spend = (shotState?: ShotState) => mount(createElement(SpendScenario, { shotState }))
/**
 * The layout checks below read the source on purpose: jsdom has no layout, so a grid, a height
 * fill or a `maw` cap can only be pinned where it is written. The shot rounds judge the geometry.
 */
const DAY_MS = 86_400_000
const values = (points: readonly { value: number }[]) => points.map((p) => p.value)

describe('1. one date format per card', () => {
  it('the page format config makes basalt print "16 Oct", not "Oct 16", at UTC', () => {
    defineFormat({ locale: 'en-US', timeZone: 'America/Los_Angeles' })
    const at = Date.UTC(2026, 9, 16)
    expect(date(at)).toContain('Oct 15')
    defineFormat(PAGE_FORMAT)
    expect(date(at)).toContain('16 Oct')
    expect(date(at)).not.toContain('Oct 16')
  })

  it('main.tsx hands that config to the provider', () => {
    // Deliberate source check: mounting `main.tsx` would boot the router and the app.
    expect(source('../main.tsx')).toMatch(/<BasaltProvider[\s\S]*?\{\.\.\.PAGE_FORMAT\}/)
  })
})

describe('2. sparklines name their point', () => {
  it.each([
    ['sessions', SESSIONS_7D_POINTS, SESSIONS_7D_TREND],
    ['volume', VOLUME_7D_POINTS, VOLUME_7D_TREND],
    ['distance', DISTANCE_7D_POINTS, DISTANCE_7D_TREND],
    ['needs-you', NEEDS_YOU_POINTS, NEEDS_YOU_TREND],
    ['dispatch spend', DISPATCH_POINTS, DISPATCH_COMPLETE_DAYS],
    ['failures by hour', FAILURES_POINTS, FAILURES_BY_HOUR],
    ['month to date', MTD_POINTS, MTD_TOTALS],
  ])('%s carries { at, value } points over the same values', (_, points, plain) => {
    expect(values(points)).toEqual([...plain])
    for (const p of points) expect(Number.isFinite(p.at)).toBe(true)
  })

  it('the points step one day (the failures one hour) and end where the window ends', () => {
    const steps = (pts: readonly { at: number }[]) => pts.slice(1).map((p, i) => p.at - pts[i]!.at)
    for (const pts of [SESSIONS_7D_POINTS, NEEDS_YOU_POINTS, DISPATCH_POINTS, MTD_POINTS]) {
      expect(new Set(steps(pts))).toEqual(new Set([DAY_MS]))
    }
    expect(new Set(steps(FAILURES_POINTS))).toEqual(new Set([3_600_000]))
    expect(new Date(SESSIONS_7D_POINTS.at(-1)!.at).getUTCDate()).toBe(16)
    expect(new Date(NEEDS_YOU_POINTS.at(-1)!.at).getUTCDate()).toBe(16)
    // Dispatch spend leaves today out: the last complete day is the 15th.
    expect(new Date(DISPATCH_POINTS.at(-1)!.at).getUTCDate()).toBe(15)
    expect(new Date(MTD_POINTS.at(-1)!.at).getUTCDate()).toBe(16)
  })

  it('every scenario sparkline is handed points, never a bare number[]', () => {
    for (const file of ['./S2Training.tsx', './S3Agents.tsx', './S4Spend.tsx']) {
      expect(source(file)).not.toMatch(
        /data=\{(?:[A-Z_]+_TREND|DISPATCH_COMPLETE_DAYS|FAILURES_BY_HOUR|MTD_TOTALS)\}/,
      )
    }
    expect(source('./S2Training.tsx')).toContain('SESSIONS_7D_POINTS')
    expect(source('./S3Agents.tsx')).toContain('FAILURES_POINTS')
    expect(source('./S4Spend.tsx')).toContain('MTD_POINTS')
  })
})

describe('3. S2 goal meter', () => {
  it('captions the Pace tick at its mark, with the target once on the track', () => {
    const goal = anchor(training(), 'goal')
    const ticks = source('./S2Training.tsx')
    // W38: the target is stated once (the end caption), the pace once (the tick caption).
    expect(ticks).toMatch(/label: `Pace /)
    const copy = text(goal)
    expect(copy).toContain(`Pace ${Math.round(PACE_SESSIONS)} sessions by ${TODAY_LABEL}`)
    expect(copy).toContain(`Target ${GOAL_SESSIONS}`)
    expect(copy.match(new RegExp(`\\b${GOAL_SESSIONS}\\b`, 'g'))).toHaveLength(1)
  })

  it('the pace verdict names its unit', () => {
    expect(text(anchor(training(), 'goal'))).toContain(`${PACE_GAP} sessions ahead of pace`)
    expect(MONTH_END_LABEL.length).toBeGreaterThan(0)
  })
})

describe('4. S3', () => {
  it('the Today footer shares the footer row and states the cap', () => {
    // W38 r1: no `under`; the day and week budgets share the strip's footer row.
    expect(source('./S3Agents.tsx')).not.toMatch(/under\??:/)
    const day = text(anchor(agents(), 'strip-footer-day'))
    expect(day).toContain(`Target ${fmtEur(BUDGETS.day.cap)}`)
    expect(day).not.toMatch(/\bof €/)
  })

  it('the awaiting error names the quantity "Awaiting", never "Needs you"', () => {
    const cell = text(anchor(agents('error'), 'strip-needs-you'))
    expect(cell).not.toMatch(/needs/i)
    expect(cell).toMatch(/awaiting/i)
    expect(source('./S3Agents.tsx')).not.toMatch(/Needs-you items/)
  })

  it('the item-flow headline separates its unit from its period', () => {
    const flow = text(anchor(agents(), 'item-flow'))
    expect(flow).toContain(`${FLOW_CLOSED} closed · ${FLOW_RANGE_LABEL}`)
  })

  it('the stuck list keeps hours, so its oldest row matches the strip', () => {
    const oldest = STUCK[0]!.waitHours
    expect(oldest).toBe(OLDEST_WAIT_HOURS)
    expect(fmtAge(oldest)).toMatch(/d \d+ h/)
    expect(text(anchor(agents(), 'stuck-items'))).toContain(fmtAge(oldest))
  })
})

describe('5. S4', () => {
  it('the distribution states its window on the surface', () => {
    expect(text(anchor(spend(), 'spend-distribution'))).toContain('median of 90 days')
  })

  it('the distribution axis names its unit on the top tick only', () => {
    const ticks = Array.from({ length: DISTRIBUTION_Y_MAX / 5 + 1 }, (_, i) => i * 5)
    expect(daysTick(DISTRIBUTION_Y_MAX)).toBe(`${DISTRIBUTION_Y_MAX} days`)
    for (const v of ticks.slice(0, -1)) expect(daysTick(v)).toBe(String(v))
    expect(DISTRIBUTION_Y_MAX).toBeGreaterThanOrEqual(Math.max(...DISTRIBUTION.map((b) => b.days)))
    // The chart is handed the same domain and formatter, so its top tick is that label.
    expect(source('./S4Spend.tsx')).toContain(
      'y={{ domain: [0, DISTRIBUTION_Y_MAX], format: daysTick }}',
    )
  })

  it('the distribution card ends level with its row neighbour', () => {
    expect(source('./S4Spend.tsx')).toMatch(
      /data-shot="spend-distribution" h="100%"[\s\S]*?<ChartCard[\s\S]*?style=\{FILL\}/,
    )
  })

  it('spend by project reads "49% of spend in 2 of 6 projects · 1–16 Oct"', () => {
    const top = PROJECTS_MTD.slice(0, 2).reduce((a, p) => a + p.pct, 0)
    expect(text(anchor(spend(), 'spend-by-project'))).toContain(
      `${top}% of spend in 2 of ${PROJECTS_MTD.length} projects · ${WINDOW_LABEL}`,
    )
  })

  it('the top-drivers error names the cause, not the failure again', () => {
    const card = text(anchor(spend('error'), 'top-drivers'))
    expect(card).toContain('The usage export did not answer')
    expect(card).not.toContain('failed to load')
    expect(card).not.toContain('Top drivers')
  })
})

describe('6. components', () => {
  // W38 r2: a capped card sat alone in its row with ~495 px empty beside it; it fills the row.
  it('lets the table card fill its row', () => {
    const src = source('../demo/ComponentsPage.tsx')
    expect(src).not.toMatch(/<Table[^>]*maw=/)
    expect(src).not.toContain('TABLE_MAX_WIDTH')
    expect(src).not.toMatch(/<Box[^>]*\bmaw=[^>]*>\s*<ComponentGroup\s+title="Table/)
    expect(src).toContain('Prior 30 d')
  })

  it('keeps "Paused" with its row at 390: Pending and Paused share one group', () => {
    const c = mount(createElement(ComponentsSurfaces, null))
    const badges = [...anchor(c, 'badges').querySelectorAll('.mantine-Badge-root')]
    const paused = badges.find((b) => (b.textContent ?? '').includes('Paused'))
    const pending = badges.find((b) => (b.textContent ?? '').includes('Pending'))
    expect(paused?.parentElement).toBe(pending?.parentElement)
    expect(paused?.parentElement?.children.length).toBe(2)
  })
})
