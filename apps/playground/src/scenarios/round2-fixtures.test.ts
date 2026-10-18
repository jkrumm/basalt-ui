/**
 * Wave 35 round 2 fixture fixes: each assertion is one defect the round's crops showed.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { ComponentsSurfaces } from '../demo/ComponentsPage'
import { STUCK } from './agents-data'
import { AgentsScenario } from './S3Agents'
import { SpendScenario } from './S4Spend'
import { TrainingScenario } from './S2Training'
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
    expect(tickLabels(cell)).toEqual(['€0', 'Budget'])
  })

  it('keeps the € out of the card titles and in the facts value', () => {
    const c = mount(createElement(SpendScenario, { shotState: undefined }))
    for (const name of ['spend-over-time', 'spend-by-project', 'top-drivers']) {
      const card = anchor(c, name)
      expect(card?.textContent).not.toContain('(€)')
      // W37 r2: spend by project leads with the top two's share of the whole, in percent.
      expect(card?.querySelector('[data-basalt-fact-value]')?.textContent).toContain(
        name === 'spend-by-project' ? '%' : '€',
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

  it('names the pace tick on the goal meter and not again in the end caption', () => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    const goal = anchor(c, 'goal')
    expect(tickLabels(goal)).toEqual(['Pace'])
    expect(goal?.querySelector('[data-meter-captions]')?.textContent).not.toContain('Pace')
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
  it('S2 reads goal, mix, load, history, then readiness and lifts', () => {
    const c = mount(createElement(TrainingScenario, { shotState: undefined }))
    expect(order(c).slice(-6)).toEqual([
      'goal',
      'session-mix',
      'training-load',
      'hit-rate',
      'readiness',
      'top-lifts',
    ])
    expect(shareGrid(c, 'training-load', 'hit-rate')).toBe(true)
    expect(shareGrid(c, 'readiness', 'top-lifts')).toBe(true)
    expect(shareGrid(c, 'hit-rate', 'readiness')).toBe(false)
  })

  it('S3 gives the waiting list and the flow chart a full-width row each', () => {
    const c = mount(createElement(AgentsScenario, { shotState: undefined }))
    expect(order(c).slice(-2)).toEqual(['stuck-items', 'item-flow'])
    expect(anchor(c, 'stuck-items')?.closest('.mantine-SimpleGrid-root')).toBeNull()
    expect(anchor(c, 'item-flow')?.closest('.mantine-SimpleGrid-root')).toBeNull()
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
