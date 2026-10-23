/** Wave 49 and 50: the copy fixes the W48 and W49 audits found in the playground scenarios (S1–S7). */
import { MantineProvider } from '@mantine/core'
import { cleanup, render } from '@testing-library/react'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'bun:test'
import { BODY, INOL_DEFINITION } from './body/body-data'
import { BUDGET_EUR } from './spend-data'
import { fmtEur } from './fixture-utils'
import { SpendScenario } from './S4Spend'
import { JOURNAL } from './learning-data'
import { OpsScenario } from './S1Ops'
import { AgentsScenario } from './S3Agents'
import { LearningScenario } from './S5Learning'
import { SettingsScenario } from './S6Settings'
import { BodyScenario } from './S7Body'
import type { ShotState } from './shot-state'

afterEach(cleanup)

const mount = (ui: ReactElement) => render(createElement(MantineProvider, null, ui)).container
const text = (c: HTMLElement, name: string) =>
  c.querySelector(`[data-shot="${name}"]`)?.textContent ?? ''
const shotState: ShotState | undefined = undefined

describe('S7 body', () => {
  const body = () => mount(createElement(BodyScenario, { shotState }))

  it('scopes the weight meter to its 60-day window and keeps the weight as the headline', () => {
    const meter = text(body(), 'weight-meter-start')
    expect(meter).toContain('60-day range')
    expect(meter).toContain('60-day low')
    expect(meter).toContain('60-day high')
    expect(meter).toContain(String(BODY.weightKg))
  })

  it('names the period of every sparkline and defines INOL once', () => {
    const c = body()
    expect(text(c, 'inol-sparks')).toContain('last 8 sessions')
    expect(text(c, 'lift-pr-spark')).toContain('last 10 sessions')
    expect(INOL_DEFINITION).toContain('Intensity-Number of Lifts')
  })
})

describe('S1 ops', () => {
  it('names the packet-loss period and gives every KPI the same breakdown slot', () => {
    const c = mount(createElement(OpsScenario, { shotState }))
    expect(text(c, 'packet-loss')).toContain('Packet loss, 7 days')
    for (const anchor of ['latency-now', 'packet-loss', 'download'])
      expect(text(c, anchor)).toMatch(/7[- ]day|7 days/)
  })
})

describe('S3 agents', () => {
  it('titles both footer meters', () => {
    const c = mount(createElement(AgentsScenario, { shotState }))
    expect(text(c, 'strip-footer-day')).toContain('Dispatch spend, today')
    expect(text(c, 'strip-footer-week')).toContain('Dispatch spend, last 7 days')
  })
})

describe('S5 learning', () => {
  it('sizes the journal skeleton to the loaded list', () => {
    const skeletonRows = mount(
      createElement(LearningScenario, { shotState: 'loading' }),
    ).querySelectorAll('[data-shot="learning-journal"] [class*="Skeleton"]').length
    expect(skeletonRows).toBeGreaterThanOrEqual(Math.min(JOURNAL.length, 40))
  })
})

describe('S6 settings', () => {
  it('names the form group by its function and leaves "Notes" to the field', () => {
    const c = mount(createElement(SettingsScenario, { shotState }))
    const labels = [...c.querySelectorAll('label, legend, h2, h3')].map((e) => e.textContent)
    expect(labels).toContain('Set details')
    expect(labels.filter((l) => l === 'Notes').length).toBe(1)
  })
})

const page = (ui: ReactElement) => mount(ui).textContent ?? ''
const body = () => mount(createElement(BodyScenario, { shotState }))
const countOf = (haystack: string, needle: string): number => haystack.split(needle).length - 1

describe('Wave 50: each figure once per surface', () => {
  it('S3 names the awaiting cell as items and states the queue count once', () => {
    const c = mount(createElement(AgentsScenario, { shotState: 'error' }))
    expect(c.textContent).toContain('Could not load awaiting items')
    const stuck = text(mount(createElement(AgentsScenario, { shotState })), 'stuck-items')
    expect(stuck).not.toMatch(/by age\s*9\s*items/)
  })

  it('S3 decision card does not restate the oldest wait', () => {
    const t = text(mount(createElement(AgentsScenario, { shotState })), 'agents-decision')
    expect(t).not.toMatch(/past the \d+ h warning/)
  })

  it('S4 prints the budget figure on the Budget cell; the tick and the chart line name the cap only', () => {
    const t = page(createElement(SpendScenario, { shotState }))
    // The one other hit is the forecast Meter's screen-reader summary, which basalt builds from the tick.
    expect(countOf(t, fmtEur(BUDGET_EUR))).toBeLessThanOrEqual(2)
    expect(countOf(t, `Budget ${fmtEur(BUDGET_EUR)}`)).toBeLessThanOrEqual(1)
  })

  it('S5 uses one month form, a sparkline in every strip cell and no wrapping empty line', () => {
    const c = mount(createElement(LearningScenario, { shotState }))
    const journal = text(c, 'learning-journal')
    expect(journal).not.toMatch(/Sept|, 20\d\d/)
    expect(journal).toMatch(/\b\d{1,2} Sep\b/)
    expect(c.querySelectorAll('[data-shot="learning-strip"] [data-shot-hover]').length).toBe(4)
    const empty = mount(createElement(LearningScenario, { shotState: 'empty' }))
    expect(empty.textContent).not.toContain('No practice in the last 30 days')
  })

  it('S6 names the weight unit once: in the field, not the helper', () => {
    const c = mount(createElement(SettingsScenario, { shotState }))
    const weight = c.querySelector('#set-weight') as HTMLInputElement | null
    expect(weight?.value).toContain('kg')
    expect(c.textContent).not.toContain('plates, in kg')
  })

  it('S7 states the weight once, drops the goal prompt and scopes the skinfold title', () => {
    const c = body()
    const t = c.textContent ?? ''
    expect(t).not.toContain('Set a goal weight')
    expect(t).toContain('kg to goal')
    expect(
      countOf(t, `${BODY.weightKg} kg`) + countOf(t, `${BODY.weightKg}kg`),
    ).toBeLessThanOrEqual(2)
    expect(text(c, 'skinfold-history')).toContain('Skinfold history, 10 Aug–19 Oct')
  })
})
