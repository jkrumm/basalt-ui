/**
 * Wave 35 round 2 fixture fixes: each assertion is one defect the round's crops showed.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { ComponentsSurfaces } from '../demo/ComponentsPage'
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
    expect(tickLabels(cell)).toEqual(['Budget'])
  })

  it('states the euro unit on the ticks and facts, not in the titles', () => {
    const c = mount(createElement(SpendScenario, { shotState: undefined }))
    for (const name of ['spend-over-time', 'spend-by-project']) {
      expect(anchor(c, name)?.textContent).not.toContain('(€)')
    }
  })

  it('keeps the forecast footer short enough not to orphan a word at 390', () => {
    const cell = anchor(
      mount(createElement(SpendScenario, { shotState: undefined })),
      'strip-forecast',
    )
    expect(cell?.textContent).toContain('€1,152 over the cap')
    expect(cell?.textContent).not.toContain('€1,500 budget')
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
  it('weekly budget error says why and what to do', () => {
    const c = mount(createElement(AgentsScenario, { shotState: 'error' }))
    const text = anchor(c, 'strip-footer-week')?.textContent
    expect(text).toContain('did not answer')
    expect(text).toContain('Retry')
  })

  it('prints the failure times beside the hourly marks, not colour alone', () => {
    const c = mount(createElement(AgentsScenario, { shotState: undefined }))
    const text = anchor(c, 'strip-failures')?.textContent
    expect(text).toContain('last 24 h')
    expect(text).toContain('19:00 · 08:00 · 13:00 UTC')
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
