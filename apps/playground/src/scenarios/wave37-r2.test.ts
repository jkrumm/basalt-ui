/**
 * Wave 37 playground round 2: the round-1 copy and composition defects the argo-bar reviewers
 * attributed to the playground. Each assertion is one a later edit could silently undo.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'bun:test'
import { ComponentsSurfaces } from '../demo/ComponentsPage'
import {
  BUDGETS,
  FLOW,
  FLOW_RANGE_LABEL,
  FLOW_SERIES,
  OLDEST_WAIT_HOURS,
  fmtAge,
} from './agents-data'
import { fmtEur, itemAt, roundShares } from './fixture-utils'
import { AgentsScenario } from './S3Agents'
import { SpendScenario } from './S4Spend'
import { TrainingScenario } from './S2Training'
import {
  BUDGET_EUR,
  DISTRIBUTION,
  DISTRIBUTION_BARS,
  MEDIAN_DAY_EUR,
  MTD_EUR,
  PROJECTS_MTD,
  WINDOW_LABEL,
  spendBand,
} from './spend-data'
import { PACE_GAP, SESSIONS_MTD, GOAL_SESSIONS } from './training-data'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const anchor = (c: HTMLElement, name: string): HTMLElement => {
  const el = c.querySelector<HTMLElement>(`[data-shot="${name}"]`)
  if (el === null) throw new Error(`no [data-shot="${name}"]`)
  return el
}
const words = (el: Element): string[] => {
  const copy = el.cloneNode(true) as Element
  for (const hidden of copy.querySelectorAll('.mantine-VisuallyHidden-root')) hidden.remove()
  const out: string[] = []
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) out.push(n.textContent ?? '')
  return out.map((w) => w.trim()).filter((w) => w !== '')
}
const text = (el: Element): string => words(el).join(' ')
const count = (haystack: string, needle: string): number => haystack.split(needle).length - 1
const source = (file: string): string => readFileSync(new URL(file, import.meta.url), 'utf8')
const training = (shotState?: ShotState) => mount(createElement(TrainingScenario, { shotState }))
const agents = (shotState?: ShotState) => mount(createElement(AgentsScenario, { shotState }))
const spend = (shotState?: ShotState) => mount(createElement(SpendScenario, { shotState }))
const rowOf = (el: Element | undefined) => el?.closest('[class*="SimpleGrid"]')
const tableAt = (state: ShotState) =>
  anchor(mount(createElement(ComponentsSurfaces, { shotState: state })), 'table')
const components = () => mount(createElement(ComponentsSurfaces, null))

describe('S2', () => {
  it('the goal card leads with the pace verdict; "17 of 28" lives in the Meter label only', () => {
    const c = training()
    const goal = text(anchor(c, 'goal'))
    // W37 r3: the verdict names its unit.
    expect(goal).toContain(`${PACE_GAP} sessions ahead of pace`)
    expect(goal).not.toContain(`${SESSIONS_MTD} of ${GOAL_SESSIONS}`)
    expect(
      anchor(c, 'goal').querySelector(`[aria-label*="${SESSIONS_MTD} of ${GOAL_SESSIONS}"]`),
    ).not.toBeNull()
  })

  it('the training-load card stretches to the hit-rate card, so the two columns end together', () => {
    const src = source('./S2Training.tsx')
    expect(src).toMatch(/<Stack gap="sm" h="100%">/)
    // Only while the body is drawn (rest, loading): an empty or failed card ends at its content.
    expect(src).toMatch(/data-shot="training-load"[^>]*fills && \{ flex: 1 \}/)
  })

  it('the summary binds its last words, so a status word never wraps alone', () => {
    expect(text(anchor(training(), 'summary'))).toMatch(/readiness \d+\u00A0is\u00A0\S+\.$/)
  })
})

describe('S3', () => {
  it('one quantity, one name: the strip says "Awaiting", never "Needs you"', () => {
    const page = text(agents())
    expect(page).not.toMatch(/needs? you/i)
    expect(count(page, 'Awaiting')).toBeGreaterThanOrEqual(2)
  })

  it('the fleet legend uses the same word as the awaiting cell', () => {
    const fleet = text(anchor(agents(), 'strip-fleet'))
    expect(fleet).toContain('Awaiting')
  })

  it('the failures error names the warden once, not "Failures failed to load"', () => {
    const cell = text(anchor(agents('error'), 'strip-failures'))
    expect(cell).not.toContain('Failures failed to load')
    expect(cell).toContain('The warden did not answer')
  })

  it('the week footer states what was spent against the cap', () => {
    // The Meter binds its last word with a no-break space.
    const week = text(anchor(agents(), 'strip-footer-week')).replaceAll('\u00A0', ' ')
    expect(week).toContain(`${fmtEur(BUDGETS.week.spent)}, last 7 days`)
    expect(week).toContain(`Target ${fmtEur(BUDGETS.week.cap)}`)
  })

  it('the item flow tooltip rows carry a unit, not the series name again', () => {
    const row = itemAt(FLOW, 0)
    for (const series of FLOW_SERIES) expect(series.formatValue?.(2, row)).toBe('2 items')
  })

  it('the empty item flow names its window', () => {
    expect(text(anchor(agents('empty'), 'item-flow'))).toContain(FLOW_RANGE_LABEL)
  })

  // W37 r3: the stuck list keeps hours so its oldest row matches the strip's Oldest wait figure.
  it('the oldest wait prints twice: the cell, and the same figure on the oldest list row', () => {
    expect(count(text(agents()), fmtAge(OLDEST_WAIT_HOURS))).toBe(2)
  })

  it('the failures clock reads "24 h ago" to "now" and drops the detached latest label', () => {
    const cell = text(anchor(agents(), 'strip-failures'))
    expect(cell).toContain('24 h ago')
    expect(cell).toContain('now')
    expect(cell).not.toMatch(/latest \d\d:00/)
    expect(cell).not.toMatch(/15:00.*15:00/)
  })

  it('the failures bars are a hover anchor, so the bar readout is shot', () => {
    const cell = anchor(agents(), 'strip-failures')
    const hover = cell.querySelector('[data-shot-hover]')
    expect(hover).not.toBeNull()
    expect(hover?.querySelector('svg')).not.toBeNull()
  })

  it('the failures empty copy keeps "24 h" together', () => {
    expect(text(anchor(agents('empty'), 'strip-failures'))).toContain('24 h')
  })
})

describe('S4', () => {
  it('top drivers names its subject', () => {
    expect(text(anchor(spend(), 'top-drivers'))).toContain('Spend change by project')
  })

  it('spend by project states the share of the whole and keeps the whole reachable', () => {
    const c = spend()
    const card = text(anchor(c, 'spend-by-project'))
    const top = PROJECTS_MTD.slice(0, 2).reduce((a, p) => a + p.pct, 0)
    expect(card).toContain(`${top}%`)
    expect(card).toContain(`in 2 of ${PROJECTS_MTD.length} projects`)
    // The whole is the spend strip's figure, stated once on the page; the card names it in its info.
    expect(source('./S4Spend.tsx')).toContain('fmtEur(MTD_EUR)')
  })

  it('project shares are whole percents that sum to 100', () => {
    expect(PROJECTS_MTD.reduce((a, p) => a + p.pct, 0)).toBe(100)
    const rows = [...anchor(spend(), 'spend-by-project').querySelectorAll('li')].map((li) =>
      text(li),
    )
    const shown = rows.map((r) => Number(/(\d+)%/.exec(r)?.[1]))
    expect(shown.reduce((a, b) => a + b, 0)).toBe(100)
  })

  it('largest-remainder rounding sums to 100 where plain rounding gives 99', () => {
    const shares = [0.334, 0.333, 0.333]
    expect(shares.reduce((a, s) => a + Math.round(s * 100), 0)).toBe(99)
    expect(roundShares(shares)).toEqual([34, 33, 33])
    expect(roundShares([0.045, 0.955])).toEqual([5, 95])
  })

  it('spend by project carries no leader accent', () => {
    expect(source('./S4Spend.tsx')).not.toMatch(
      /label=\{`Spend by project[\s\S]*?accentLeader[\s\S]*?\/>/,
    )
  })

  it.each([
    ['strip-month-to-date', WINDOW_LABEL],
    ['strip-forecast', WINDOW_LABEL],
    ['top-drivers', WINDOW_LABEL],
    ['spend-over-time', WINDOW_LABEL],
    ['spend-by-project', WINDOW_LABEL],
    ['spend-distribution', 'last 90 days'],
  ])('the empty %s copy names its window', (name, window) => {
    expect(text(anchor(spend('empty'), name))).toContain(window)
  })

  it('the empty budget cell shows the cap as its figure, not a dash', () => {
    const cell = anchor(spend('empty'), 'strip-budget')
    const value = cell.querySelector('[data-strip-value]')
    expect(value?.textContent).toBe(fmtEur(BUDGET_EUR))
  })

  it('the histogram has one series, and the median bin is told by a footer fact, not colour', () => {
    const card = text(anchor(spend(), 'spend-distribution'))
    const bin = DISTRIBUTION.findLast((b) => b.from <= MEDIAN_DAY_EUR)
    expect(bin).toBeDefined()
    expect(card).toContain(fmtEur(MEDIAN_DAY_EUR))
    expect(card).toContain(`${bin?.days} days in ${spendBand({ from: bin?.from ?? 0 })}`)
    expect(card).not.toContain('Median day')
    expect(source('./S4Spend.tsx')).not.toContain("key: 'median'")
  })

  it('the histogram tooltip row carries a unit', () => {
    const bar = DISTRIBUTION_BARS[0]
    const row = itemAt(DISTRIBUTION, 0)
    expect(bar?.formatValue?.(23, row)).toBe('23 days')
    expect(bar?.formatValue?.(1, row)).toBe('1 day')
  })

  it('month-to-date spend still prints once on the page', () => {
    expect(count(text(spend()), fmtEur(MTD_EUR))).toBe(1)
  })
})

describe('components page', () => {
  it('declares the states the table renders, on its own anchor', () => {
    const el = anchor(components(), 'table')
    expect(el.getAttribute('data-shot-states')).toBe('empty loading error')
    expect(el.querySelector('table')).not.toBeNull()
  })

  it('the table anchor renders its empty state with a title', () => {
    const el = tableAt('empty')
    expect(text(el)).toContain('No metrics in the last 30 days')
    expect(el.querySelector('table')).toBeNull()
  })

  it('the table anchor renders its error state with a title and a Retry button', () => {
    const el = tableAt('error')
    expect(text(el)).toContain('Could not load metrics')
    const retry = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Retry')
    expect(retry).toBeDefined()
    expect(el.querySelector('table')).toBeNull()
  })

  it('the table anchor renders skeleton rows while loading, and no figures', () => {
    const el = tableAt('loading')
    expect(el.querySelectorAll('tbody tr')).toHaveLength(4)
    expect(el.querySelectorAll('.mantine-Skeleton-root').length).toBeGreaterThan(0)
    expect(text(el)).not.toContain('12,480')
  })

  it('has no narration strings', () => {
    const page = text(components())
    expect(page).not.toContain('same shadow-card')
    expect(page).not.toContain('Popover content on a panel surface')
  })

  it('scopes every group title', () => {
    const titles = [...components().querySelectorAll('h2, h3, h4')].map((t) => text(t))
    for (const bare of ['Accordion', 'Code', 'Toggles', 'Empty state', 'Dropdown surfaces']) {
      expect(titles).not.toContain(bare)
    }
    expect(titles).toContain('Toggles: switch, checkbox and radio')
  })

  // W38 r1: the period moved from every row label into the column headers, where it prints once.
  it('the table totals carry a period', () => {
    const head = text(components().querySelector('thead') as Element)
    expect(head).toMatch(/Last 30 d/)
    expect(head).toMatch(/Prior 30 d/)
  })

  it('the churn change is in percentage points', () => {
    const rows = [...components().querySelectorAll('tbody tr')].map((r) => text(r))
    expect(rows.find((r) => r.startsWith('Churn'))).toContain('0.4 pp')
  })

  it('the dropdown surfaces card reserves the room its open Menu and Popover need', () => {
    expect(source('../demo/ComponentsPage.tsx')).toMatch(/mih=\{\d+\}/)
  })

  it('pairs Toggles with the Empty state instead of leaving it alone in its row', () => {
    const c = components()
    const toggles = [...c.querySelectorAll('h2, h3, h4')].find((t) => text(t).startsWith('Toggles'))
    const empty = [...c.querySelectorAll('h2, h3, h4')].find((t) => text(t).startsWith('Empty'))
    expect(toggles).toBeDefined()
    expect(empty).toBeDefined()
    expect(rowOf(toggles)).toBe(rowOf(empty))
  })
})
