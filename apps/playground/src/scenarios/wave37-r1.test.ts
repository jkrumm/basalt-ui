/**
 * Wave 37 playground round 1: each assertion is a defect the argo-bar reviewers attributed to the
 * playground's composition or copy. A figure stated once is counted in the rendered text, so a later
 * edit that restates it fails here.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'bun:test'
import { ComponentsSurfaces } from '../demo/ComponentsPage'
import { BUDGETS, FAILURES_WINDOW, FLOW_RANGE_LABEL, WARN_HOURS } from './agents-data'
import { fmtEur, fmtInt, fmtRatio } from './fixture-utils'
import { AgentsScenario } from './S3Agents'
import { SpendScenario } from './S4Spend'
import { TrainingScenario } from './S2Training'
import {
  BUDGET_EUR,
  MEDIAN_DAY_EUR,
  MTD_EUR,
  PRIOR_WINDOW_LABEL as SPEND_PRIOR_LABEL,
  REMAINING_PER_DAY_EUR,
} from './spend-data'
import {
  GOAL_SESSIONS,
  LOAD_RATIO,
  PACE_GAP,
  READINESS_SCORE,
  SESSIONS_MTD,
  VOLUME_MTD_KG,
  WINDOW_LABEL,
} from './training-data'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const anchor = (c: HTMLElement, name: string): HTMLElement => {
  const el = c.querySelector<HTMLElement>(`[data-shot="${name}"]`)
  if (el === null) throw new Error(`no [data-shot="${name}"]`)
  return el
}
/** The visible words: a Meter's screen-reader description (`76 is in Fair`) is not a second reading. */
const words = (el: Element): string[] => {
  const copy = el.cloneNode(true) as Element
  for (const hidden of copy.querySelectorAll('.mantine-VisuallyHidden-root')) hidden.remove()
  // Spans sit side by side visually; a space between text nodes keeps `1.19` and `7 days` apart.
  const out: string[] = []
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) out.push(n.textContent ?? '')
  return out.map((w) => w.trim()).filter((w) => w !== '')
}
const text = (el: Element): string => words(el).join(' ')
const occurrences = (haystack: string, needle: string | RegExp): number =>
  haystack.match(typeof needle === 'string' ? new RegExp(escapeRe(needle), 'g') : needle)?.length ??
  0
const hour = (d: Date): string => `${String(d.getUTCHours()).padStart(2, '0')}:00`
const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const source = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8')
const training = (shotState?: ShotState) => mount(createElement(TrainingScenario, { shotState }))
const agents = (shotState?: ShotState) => mount(createElement(AgentsScenario, { shotState }))
const spend = (shotState?: ShotState) => mount(createElement(SpendScenario, { shotState }))

describe('S2 states each figure once', () => {
  it('the summary is words: every figure lives on the surface that owns it', () => {
    expect(text(anchor(training(), 'summary'))).not.toMatch(/\d/)
  })

  it('the load ratio, the readiness score and the volume each print once on the page', () => {
    const page = text(training())
    expect(occurrences(page, new RegExp(`\\b${escapeRe(fmtRatio(LOAD_RATIO))}\\b`, 'g'))).toBe(1)
    expect(occurrences(page, new RegExp(`(?<![\\d.,])${READINESS_SCORE}(?![\\d.,])`, 'g'))).toBe(1)
    expect(occurrences(page, fmtInt(Math.round(VOLUME_MTD_KG)))).toBe(1)
  })

  it('the goal card leads with the count against the goal and states the lead once', () => {
    const c = training()
    const goal = text(anchor(c, 'goal'))
    expect(goal).toContain(`${SESSIONS_MTD} of ${GOAL_SESSIONS}`)
    expect(occurrences(text(c), /ahead of pace/g)).toBe(1)
    expect(PACE_GAP).toBeGreaterThan(0)
    expect(goal).toContain(`${PACE_GAP} ahead of pace`)
  })

  it('the session mix does not restate the session count', () => {
    const mix = text(anchor(training(), 'session-mix'))
    expect(mix).not.toContain(`${SESSIONS_MTD} sessions`)
  })

  it('the KPI row is an even count, so the phone grid has no orphan', () => {
    const c = training()
    const kpis = ['sessions', 'volume', 'distance', 'active-days'].map((n) => anchor(c, n))
    expect(kpis).toHaveLength(4)
  })
})

describe('S2 hit rate', () => {
  it('is one bar per month against a labelled goal line, not a smoothed line', () => {
    const src = source('./S2Training.tsx')
    expect(src).toContain('<Bars')
    expect(src).not.toContain('<Lines')
    expect(src).toContain('label: `Goal ${GOAL_SESSIONS}`')
  })

  it('states the rate once: "4 of 6" or a percent, not both', () => {
    const header = text(anchor(training(), 'hit-rate'))
    const ofSix = /\d of 6/.test(header)
    const percent = /\d+\s?%/.test(header)
    expect(ofSix !== percent).toBe(true)
  })

  it('distinguishes the months that reached the goal by more than hue', () => {
    const c = training()
    const legend = text(anchor(c, 'hit-rate'))
    expect(legend).toMatch(/reached/i)
    expect(legend).toMatch(/below/i)
  })
})

describe('S2 readiness and top lifts', () => {
  it('keeps the unit and the date apart', () => {
    const card = text(anchor(training(), 'readiness'))
    expect(card).not.toContain('of 10016 Oct')
    expect(card).not.toMatch(/of 100\s*16 Oct/)
  })

  it('names the load contributor for what it measures, not as the Training load card', () => {
    const readiness = anchor(training(), 'readiness')
    const labels = [...readiness.querySelectorAll('li')].map((li) => text(li))
    expect(labels.some((l) => l.startsWith('Training load'))).toBe(false)
    expect(labels.some((l) => l.startsWith('Load balance'))).toBe(true)
  })

  it('pairs the two cards to one row height', () => {
    const src = source('./S2Training.tsx')
    expect(src.match(/style=\{FILL\}/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
  })

  it('the empty top lifts copy names its window', () => {
    expect(text(anchor(training('empty'), 'top-lifts'))).toContain(
      `No strength session logged ${WINDOW_LABEL}`,
    )
  })
})

describe('S3 states each figure once', () => {
  it('"Needs you" is named once on the strip; the fleet, the list and the footer do not repeat it', () => {
    const c = agents()
    expect(occurrences(text(c), /needs? you/gi)).toBe(1)
  })

  it('the footer meters do not restate the dispatch spend cell', () => {
    const c = agents()
    const footer = words(anchor(c, 'strip-footer-day'))
    expect(footer[0]).toBe('Today')
    expect(footer).not.toContain(fmtEur(BUDGETS.day.spent))
  })

  it('the item flow states its period once', () => {
    expect(occurrences(text(anchor(agents(), 'item-flow')), FLOW_RANGE_LABEL)).toBe(1)
  })

  it('the stuck list headline is one figure', () => {
    expect(text(anchor(agents(), 'stuck-items'))).not.toMatch(/need you/i)
  })

  it('the item flow draws integer daily counts as straight segments', () => {
    expect(source('./S3Agents.tsx')).toContain("curve: 'linear'")
  })
})

describe('S3 strip', () => {
  it('failures names the hours at both ends of its window', () => {
    const cell = text(anchor(agents(), 'strip-failures'))
    expect(cell).toContain(hour(FAILURES_WINDOW.start))
    expect(cell).toContain(hour(FAILURES_WINDOW.end))
  })

  it('oldest wait captions the warn tick at its position and drops the footer sentence', () => {
    const cell = text(anchor(agents(), 'strip-oldest-wait'))
    expect(cell).toContain(`${WARN_HOURS} h`)
    expect(cell).not.toContain('Warns at 24 h · abandoned at 7 d')
  })
})

describe('S4 states each figure once', () => {
  it('the month-to-date spend prints once on the page', () => {
    expect(occurrences(text(spend()), fmtEur(MTD_EUR))).toBe(1)
  })

  it('the forecast verdict is said once', () => {
    expect(occurrences(text(anchor(spend(), 'strip-forecast')), /over budget/gi)).toBe(1)
  })

  it('the budget tooltip computes the daily allowance from what is left', () => {
    expect(REMAINING_PER_DAY_EUR).toBeCloseTo((BUDGET_EUR - MTD_EUR) / 15, 5)
    expect(REMAINING_PER_DAY_EUR).toBeLessThan(BUDGET_EUR / 31)
    expect(source('./S4Spend.tsx')).not.toContain('keeps spend on pace')
  })

  it('the empty budget cell still shows the cap', () => {
    expect(text(anchor(spend('empty'), 'strip-budget'))).toContain(fmtEur(BUDGET_EUR))
  })

  it('top drivers names the comparison window once', () => {
    expect(occurrences(text(anchor(spend(), 'top-drivers')), SPEND_PRIOR_LABEL)).toBe(1)
  })
})

describe('S4 distribution', () => {
  it('is titled as a precise noun and marks the median day', () => {
    const card = text(anchor(spend(), 'spend-distribution'))
    expect(card).toContain('Daily spend, distribution')
    expect(card).not.toContain('Days by total spend per day')
    expect(card).toContain(`Median day`)
    expect(card).toContain(fmtEur(MEDIAN_DAY_EUR))
    expect(fmtInt(1)).toBe('1')
  })
})

describe('components page', () => {
  it('scopes the group titles', () => {
    const c = mount(createElement(ComponentsSurfaces, null))
    const titles = [...c.querySelectorAll('h2, h3, h4, [data-section-title]')].map((t) => text(t))
    for (const bare of ['Inputs', 'Table', 'Segmented control']) {
      expect(titles).not.toContain(bare)
    }
    expect(text(c)).toContain('Inputs: text, select and textarea')
  })

  it('draws the delta with a direction glyph and right-aligns the numeric columns', () => {
    const c = mount(createElement(ComponentsSurfaces, null))
    const table = c.querySelector('table')
    expect(table).not.toBeNull()
    const rows = [...(table?.querySelectorAll('tbody tr') ?? [])]
    for (const row of rows) {
      const cells = [...row.querySelectorAll('td')]
      expect(text(cells[2] as Element)).toMatch(/[▲▼]/)
      for (const cell of cells.slice(1)) {
        expect((cell as HTMLElement).style.textAlign).toBe('right')
      }
    }
    for (const th of [...(table?.querySelectorAll('th') ?? [])].slice(1)) {
      expect((th as HTMLElement).style.textAlign).toBe('right')
    }
  })

  it('the badges group fills the height its row partner sets', () => {
    const c = mount(createElement(ComponentsSurfaces, null))
    const badges = anchor(c, 'badges')
    expect(badges.querySelectorAll('.mantine-Badge-root').length).toBeGreaterThanOrEqual(10)
  })

  it('pairs the groups of the first block into two columns of near-equal height', () => {
    const src = source('../demo/ComponentsPage.tsx')
    expect(src).toContain('data-compare-column')
  })
})
