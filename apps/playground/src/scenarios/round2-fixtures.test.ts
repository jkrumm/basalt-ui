/**
 * Wave 35 round 2 fixture fixes: each assertion is one defect the round's crops showed.
 */
import { ColorSwatch, MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ComponentType, ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { ComponentsSurfaces } from '../demo/ComponentsPage'
import { STUCK } from './agents-data'
import { WINDOW_LABEL as OPS_WINDOW_LABEL } from './ops-data'
import { OpsScenario } from './S1Ops'
import { AgentsScenario } from './S3Agents'
import { SpendScenario } from './S4Spend'
import { TrainingScenario } from './S2Training'
import { NO_STRENGTH, SESSION_LOG } from './training-data'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container

const anchor = (c: HTMLElement, name: string) =>
  c.querySelector<HTMLElement>(`[data-shot="${name}"]`)

const tickLabels = (el: HTMLElement | null) =>
  [...(el?.querySelectorAll('[data-meter-tick-label]') ?? [])].map((n) => n.textContent)

describe('S4 spend', () => {
  it('states the overage once in the forecast cell', () => {
    const cell = anchor(
      mount(createElement(SpendScenario, { shotState: undefined })),
      'strip-forecast',
    )
    expect(cell?.textContent?.match(/€1,152/g)).toHaveLength(1)
  })

  it('names the budget tick on the forecast meter', () => {
    const cell = anchor(
      mount(createElement(SpendScenario, { shotState: undefined })),
      'strip-forecast',
    )
    // W38 r1: the part captions own the row under the track, so the Budget tick states its figure in its label.
    expect(tickLabels(cell)).toEqual(['€0', 'Budget €1,500'])
    expect(cell?.textContent).toContain('€1,500')
  })

  it('keeps the € out of the card titles and in the facts value', () => {
    const c = mount(createElement(SpendScenario, { shotState: undefined }))
    for (const name of ['spend-over-time', 'spend-by-project', 'top-drivers']) {
      const card = anchor(c, name)
      expect(card?.textContent).not.toContain('(€)')
      // W37 r2: spend by project leads with the top two's share of the whole, in percent.
      // W38: cumulative spend leads with the day the forecast reaches the budget.
      expect(card?.querySelector('[data-basalt-fact-value]')?.textContent).toMatch(
        name === 'spend-by-project' ? /%/ : name === 'spend-over-time' ? /^\d+ \w+$/ : /€/,
      )
    }
  })

  it('keeps the forecast footer to a few words so nothing orphans at 390', () => {
    const cell = anchor(
      mount(createElement(SpendScenario, { shotState: undefined })),
      'strip-forecast',
    )
    const footer = cell?.querySelector('[data-strip-footer]')?.textContent ?? ''
    expect(footer).toBe('€1,152 over budget')
    expect(footer.split(' ').length).toBeLessThanOrEqual(4)
  })

  it.each<ShotState>(['empty', 'error'])(
    'top drivers in %s uses the ChartCard anatomy',
    (s: ShotState) => {
      const c = mount(createElement(SpendScenario, { shotState: s }))
      const drivers = anchor(c, 'top-drivers')
      // Section renders data-tier="section"; ChartCard does not.
      expect(drivers?.querySelector('[data-tier="section"]')).toBeNull()
      if (s === 'error') {
        const retry = [...(drivers?.querySelectorAll('button') ?? [])].find(
          (b) => b.textContent === 'Retry',
        )
        expect(retry).toBeDefined()
      }
    },
  )
})

describe('S3 agents', () => {
  it('error drops the budget footer and puts a Retry in every strip cell', () => {
    const c = mount(createElement(AgentsScenario, { shotState: 'error' }))
    expect(anchor(c, 'strip-footer-week')).toBeNull()
    for (const cell of c.querySelectorAll('[data-strip-cell]')) {
      expect(cell.textContent).toContain('Retry')
    }
  })

  it('prints the failure times beside the hourly marks, not colour alone', () => {
    const c = mount(createElement(AgentsScenario, { shotState: undefined }))
    const text = anchor(c, 'strip-failures')?.textContent
    expect(text).toContain('last 24 h')
    // W37 r2: the footer is the clock under the bars, "24 h ago" to "now"; the hover names the hour.
    expect(text).toContain('24\u00A0h ago')
    expect(text).toContain('now')
  })

  it('pairs cells of similar height in the two-column layout', () => {
    const c = mount(createElement(AgentsScenario, { shotState: undefined }))
    const order = [...c.querySelectorAll('[data-strip-cell]')].map((n) =>
      n.getAttribute('data-strip-cell'),
    )
    expect(order).toEqual(['needs-you', 'dispatch-spend', 'oldest-wait', 'failures', 'fleet'])
  })
})

describe('S2 training', () => {
  it('draws the hit rate as its monthly history with every month labelled', () => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    const card = anchor(c, 'hit-rate')
    expect(card?.querySelector('[data-meter-ring]')).toBeNull()
    for (const m of ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']) {
      expect(card?.textContent).toContain(m)
    }
  })

  // W37 r3 (#402): the bar with ticks labels `format(min)` at its start, so the start figure joins the tick labels.
  it('names the pace tick on the goal meter and not again in the end caption', () => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    const goal = anchor(c, 'goal')
    // W38 r1: the pace is named by its tick label (the caption row is crowded by the reading), not again under the track.
    expect(goal?.textContent).toContain('Pace')
    expect(goal?.querySelector('[data-meter-captions]')?.textContent ?? '').not.toContain('Pace')
  })
})

const headers = (c: HTMLElement, name: string) =>
  [...(anchor(c, name)?.querySelectorAll('th') ?? [])].map((n) => n.textContent)

describe('W42 r1 tables', () => {
  it('S1 outages read Started as a relative time, with no End and a neutral Scope', () => {
    const table = anchor(mount(createElement(OpsScenario, { shotState: undefined })), 'outages')
    expect(table?.textContent).toContain('Started')
    expect(table?.textContent).toContain('yesterday')
    expect(table?.textContent).not.toContain('End (UTC)')
    const time = table?.querySelector('time')
    expect(time?.getAttribute('aria-label')).toBeNull()
    expect(time?.textContent).toContain(', Thu, 15 Oct 2026, 09:30 UTC')
    expect(time?.getAttribute('tabindex')).toBe('0')
    expect(table?.querySelector('td[data-kind="relative-time"]')).not.toBeNull()
    expect(table?.querySelector('[data-kind="status"]')).toBeNull()
  })

  it('S2 titles the log with its scope and states the 1RM formula', () => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    const log = anchor(c, 'session-log')
    expect(log?.textContent).toContain('Lift log, 1–16 Oct')
    expect(headers(c, 'session-log').join(' ')).toContain('Est. 1RM (kg, Epley)')
  })

  it('S2 draws no exercise glyph: colour on the log is the result column only', () => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    const swatch = '[class*="ColorSwatch"]'
    // Positive control: the selector does find a swatch when one is drawn.
    expect(
      mount(
        createElement(ColorSwatch as ComponentType<{ color: string }>, { color: 'red' }),
      ).querySelector(swatch),
    ).not.toBeNull()
    expect(anchor(c, 'session-log')?.querySelector(swatch)).toBeNull()
  })

  it('S2 declares the date tooltip for the shot', () => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    expect(anchor(c, 'session-log')?.querySelector('[data-shot-tooltip]')).not.toBeNull()
  })

  it('S2 date cell is a focusable <time> whose text carries its full date', () => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    const time = anchor(c, 'session-log')?.querySelector('time')
    expect(time?.getAttribute('tabindex')).toBe('0')
    const newest = SESSION_LOG[0]?.date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    })
    expect(time?.getAttribute('aria-label')).toBeNull()
    expect(time?.textContent).toContain(`, ${newest}`)
  })

  it('S2 empty log states the cause and has no dead action', () => {
    const c = mount(createElement(TrainingScenario, { shotState: 'empty' }))
    const log = anchor(c, 'session-log')
    expect(log?.textContent).toContain(NO_STRENGTH)
    expect(log?.textContent).not.toMatch(/filter/i)
    expect([...(log?.querySelectorAll('button') ?? [])].map((b) => b.textContent)).not.toContain(
      'Log a lift',
    )
  })
})

describe('W42 r2 fixtures', () => {
  it('S2 empty log and empty top lifts say the gap the same way', () => {
    const c = mount(createElement(TrainingScenario, { shotState: 'empty' }))
    const gap = NO_STRENGTH
    expect(anchor(c, 'session-log')?.textContent).toContain(gap)
    expect(anchor(c, 'top-lifts')?.textContent).toContain(gap)
  })

  it('S2 log has the facet and no second search field for the same column', () => {
    const log = anchor(
      mount(createElement(TrainingScenario, { shotState: undefined })),
      'session-log',
    )
    expect(log?.querySelector('input[placeholder="Search exercises"]')).toBeNull()
    expect(log?.textContent).toContain('Any exercise')
  })

  it('S1 empty outages names the range without a preposition', () => {
    const table = anchor(mount(createElement(OpsScenario, { shotState: 'empty' })), 'outages')
    expect(table?.textContent).toContain(`No outage ${OPS_WINDOW_LABEL}.`)
    expect(table?.textContent).not.toContain('No outage in')
  })
})

describe('components page', () => {
  it('scopes the group titles', () => {
    const c = mount(createElement(ComponentsSurfaces, null))
    const titles = [...c.querySelectorAll('[data-widget-title]')].map((n) => n.textContent)
    expect(titles).toContain('Button variants and sizes')
    expect(titles).toContain('Tabs: default and pills')
    expect(titles).not.toContain('Buttons')
    expect(titles).not.toContain('Tabs')
    expect(titles).toContain('Status badges and counts')
    expect(titles).not.toContain('Badges')
  })
})

/** The `data-shot` anchors in document order (the 390 single-column reading order). */
const order = (c: HTMLElement): string[] =>
  [...c.querySelectorAll('[data-shot]')].map((n) => n.getAttribute('data-shot') ?? '')

/** Whether two anchors sit in the same grid, i.e. share one row at two columns. */
const shareGrid = (c: HTMLElement, a: string, b: string): boolean => {
  const grid = anchor(c, a)?.closest('.mantine-SimpleGrid-root')
  return (
    grid !== null &&
    grid !== undefined &&
    grid === anchor(c, b)?.closest('.mantine-SimpleGrid-root')
  )
}

describe('composition', () => {
  it('S2 reads goal, mix, load, history, readiness and lifts, then the session log', () => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    expect(order(c).slice(-7)).toEqual([
      'goal',
      'session-mix',
      'training-load',
      'hit-rate',
      'readiness',
      'top-lifts',
      'session-log',
    ])
    expect(shareGrid(c, 'training-load', 'hit-rate')).toBe(true)
    expect(shareGrid(c, 'readiness', 'top-lifts')).toBe(true)
    expect(shareGrid(c, 'hit-rate', 'readiness')).toBe(false)
  })

  it('S3 gives the waiting list, the flow chart and the item timeline a full-width row each', () => {
    const c = mount(createElement(AgentsScenario, { shotState: undefined }))
    expect(order(c).slice(-3)).toEqual(['stuck-items', 'item-flow', 'item-timeline'])
    expect(anchor(c, 'stuck-items')?.closest('.mantine-SimpleGrid-root')).toBeNull()
    expect(anchor(c, 'item-flow')?.closest('.mantine-SimpleGrid-root')).toBeNull()
    expect(anchor(c, 'item-timeline')?.closest('.mantine-SimpleGrid-root')).toBeNull()
  })

  it('S3 lists every waiting or blocked item', () => {
    const c = mount(createElement(AgentsScenario, { shotState: undefined }))
    expect(anchor(c, 'stuck-items')?.querySelectorAll('li')).toHaveLength(STUCK.length)
  })

  it('S4 pairs chart with chart and list with list', () => {
    const c = mount(createElement(SpendScenario, { shotState: undefined }))
    expect(order(c).slice(-4)).toEqual([
      'spend-over-time',
      'spend-distribution',
      'spend-by-project',
      'top-drivers',
    ])
    expect(shareGrid(c, 'spend-over-time', 'spend-distribution')).toBe(true)
    expect(shareGrid(c, 'spend-by-project', 'top-drivers')).toBe(true)
    expect(shareGrid(c, 'spend-distribution', 'spend-by-project')).toBe(false)
  })
})
